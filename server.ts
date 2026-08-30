import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Client securely on the server
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'dtx_system' },
      auth: { persistSession: false }
    })
  : null;

// Dedicated Public Schema Supabase Client (without dtx_system db configuration)
const publicSupabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    })
  : null;

// Helper to validate standard UUID format
const isUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// Clean payload for Postgres tables where id is UUID
const cleanUuidPayload = (body: any) => {
  if (body && typeof body === 'object') {
    const copy = { ...body };
    if (copy.id !== undefined && !isUuid(copy.id)) {
      delete copy.id;
    }
    return copy;
  }
  return body;
};

// Helper to check database configuration
const checkDbConfig = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!supabase && !publicSupabase) {
    return res.status(503).json({ error: "ระบบฐานข้อมูล Supabase ยังไม่ได้กำหนดค่าฝั่งเซิร์ฟเวอร์ (SUPABASE_URL, SUPABASE_ANON_KEY)" });
  }
  next();
};

// Helper to proxy table queries for public schema views with dtx_ prefix
function createSchemaAwareClient(baseClient: any, isPublicSchema = false) {
  if (!isPublicSchema) return baseClient;
  return new Proxy(baseClient, {
    get(target, prop) {
      if (prop === 'from') {
        return (table: string) => {
          const viewName = (table === 'master_wards' || table.startsWith('dtx_') || table.startsWith('information_schema'))
            ? table
            : `dtx_${table}`;
          return target.from(viewName);
        };
      }
      return target[prop];
    }
  });
}

// Query helper for READ queries (primary dtx_system schema, fallback public)
async function executeSupabaseQuery<T>(
  queryFn: (client: any) => Promise<{ data: T; error: any }>,
  fallbackValue?: T
): Promise<T> {
  if (!supabase && !publicSupabase) {
    return (fallbackValue ?? []) as unknown as T;
  }

  // 1. Try dtx_system schema directly FIRST
  if (supabase) {
    try {
      const dtxClient = supabase.schema('dtx_system');
      const { data: dtxData, error: dtxError } = await queryFn(dtxClient);
      if (!dtxError && dtxData !== null && dtxData !== undefined) {
        if (!Array.isArray(dtxData) || dtxData.length > 0) {
          return dtxData;
        }
      }
    } catch (err: any) {
      console.warn("dtx_system query exception:", err?.message || err);
    }
  }

  // 2. Try public schema view bridge fallback (with dtx_ prefix awareness)
  const pubClient = publicSupabase || (supabase ? supabase.schema('public') : null);
  if (pubClient) {
    try {
      const proxyClient = createSchemaAwareClient(pubClient, true);
      const { data: pubData, error: pubError } = await queryFn(proxyClient);
      if (!pubError && pubData !== null && pubData !== undefined) {
        return pubData;
      }
      // Retry without proxy if needed
      const { data: rawData, error: rawError } = await queryFn(pubClient);
      if (!rawError && rawData !== null && rawData !== undefined) {
        return rawData;
      }
    } catch (err: any) {
      console.warn("public view query exception:", err?.message || err);
    }
  }

  return (fallbackValue ?? []) as unknown as T;
}

// Query helper for WRITE queries (primary dtx_system schema, fallback public)
async function executeSupabaseWrite<T>(
  queryFn: (client: any) => Promise<{ data: T; error: any }>
): Promise<T> {
  if (!supabase && !publicSupabase) {
    throw new Error("Supabase client is not configured on server (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  // 1. Try dtx_system schema directly FIRST
  if (supabase) {
    try {
      const dtxClient = supabase.schema('dtx_system');
      const { data: dtxData, error: dtxError } = await queryFn(dtxClient);
      if (!dtxError && dtxData !== null && dtxData !== undefined) {
        return dtxData;
      }
      if (dtxError) {
        console.warn("dtx_system write notice:", dtxError.message || dtxError);
      }
    } catch (err: any) {
      console.warn("dtx_system write exception:", err?.message || err);
    }
  }

  // 2. Try public schema fallback (with dtx_ prefix awareness)
  const pubClient = publicSupabase || (supabase ? supabase.schema('public') : null);
  if (pubClient) {
    try {
      const proxyClient = createSchemaAwareClient(pubClient, true);
      const { data: pubData, error: pubError } = await queryFn(proxyClient);
      if (!pubError && pubData !== null && pubData !== undefined) {
        return pubData;
      }
      // Retry direct
      const { data: rawData, error: rawError } = await queryFn(pubClient);
      if (!rawError && rawData !== null && rawData !== undefined) {
        return rawData;
      }
      if (pubError || rawError) {
        throw (pubError || rawError);
      }
    } catch (err: any) {
      throw new Error(err?.message || "Failed to execute Supabase database write operation");
    }
  }

  throw new Error("Failed to execute Supabase database write operation");
}

// ==========================================================================
// 1. Database Configuration & Status Endpoints
// ==========================================================================

app.get("/api/supabase/status", (req, res) => {
  res.json({
    configured: !!supabase,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "",
  });
});

app.get("/api/supabase/config", (req, res) => {
  res.json({
    configured: !!(supabaseUrl && supabaseAnonKey),
    url: supabaseUrl || "",
    anonKey: supabaseAnonKey || "",
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: "กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน" });
    }
    const cleanId = String(identifier).trim();
    const cleanPass = String(password).trim();

    if (!supabase && !publicSupabase) {
      return res.status(503).json({ success: false, error: "ยังไม่ได้กำหนดค่าการเชื่อมต่อฐานข้อมูลบนเซิร์ฟเวอร์" });
    }

    const authClient = publicSupabase || supabase;
    if (!authClient) {
      return res.status(503).json({ success: false, error: "ไม่สามารถสร้าง Auth Client ได้" });
    }

    // Try Supabase Auth
    const candidateEmails = cleanId.includes("@")
      ? [cleanId]
      : [
          `${cleanId.toLowerCase()}@sangkha-hospital.com`,
          `${cleanId.toLowerCase()}@gmail.com`,
        ];

    let lastError = "";
    for (const email of candidateEmails) {
      try {
        const { data, error } = await authClient.auth.signInWithPassword({
          email,
          password: cleanPass,
        });

        if (!error && data?.user) {
          const userMeta = data.user.user_metadata || {};
          let role = userMeta.role || "staff";
          if (cleanId.toLowerCase() === "admin" || email.toLowerCase().startsWith("admin@")) {
            role = "admin";
          }
          return res.json({
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              role,
              name: userMeta.name || data.user.email?.split("@")[0] || cleanId,
              token: data.session?.access_token,
            },
          });
        }
        if (error) lastError = error.message;
      } catch (err: any) {
        lastError = err?.message || "";
      }
    }

    // Try users table
    try {
      const data = await executeSupabaseQuery(client =>
        client.from("users").select("*").or(`username.eq.${cleanId},email.eq.${cleanId}`).maybeSingle()
      );
      if (data && (data as any).password === cleanPass) {
        return res.json({
          success: true,
          user: {
            id: (data as any).id || "db-user",
            email: (data as any).email || `${cleanId}@sangkha-hospital.com`,
            role: (data as any).role || "admin",
            name: (data as any).name || (data as any).username || cleanId,
          },
        });
      }
    } catch {}

    return res.status(401).json({
      success: false,
      error: lastError.includes("Invalid login credentials")
        ? "ชื่อผู้ใช้งาน/อีเมล หรือรหัสผ่านไม่ถูกต้อง"
        : (lastError || "ไม่พบข้อมูลผู้ใช้งาน หรือรหัสผ่านไม่ถูกต้อง"),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์" });
  }
});

app.get("/api/debug/schema", checkDbConfig, async (req, res) => {
  try {
    const { data, error } = await supabase!
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public");
      
    if (error) throw error;
    res.json({ tables: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to list columns for a table
app.get("/api/debug/columns/:table", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  const table = req.params.table;
  try {
    const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', table);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ columns: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================================
// 2. Data Entity REST Endpoints (Backend Proxy)
// ==========================================================================

// --- dtx_machines ---
app.get("/api/machines", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("dtx_machines").select("*")
    );
    const sorted = ((data as any[]) || []).sort(
      (a: any, b: any) => new Date(b.created_at || b.install_date || 0).getTime() - new Date(a.created_at || a.install_date || 0).getTime()
    );
    // Deduplicate by bgm_code / serial_number / id
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (const item of sorted) {
      const code = String(item.bgm_code || item.serial_number || item.code || item.serialNumber || '').trim().toUpperCase();
      const id = String(item.id || '').trim();
      const key = code || id;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      } else if (!key) {
        deduplicated.push(item);
      }
    }
    res.json(deduplicated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/machines", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("dtx_machines").insert([payload]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/machines/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const query = isUuid(id)
      ? (client: any) => client.from("dtx_machines").update(req.body).eq("id", id).select("*").maybeSingle()
      : (client: any) => client.from("dtx_machines").update(req.body).eq("bgm_code", id).select("*").maybeSingle();

    const data = await executeSupabaseWrite(query);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/machines/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const query = isUuid(id)
      ? (client: any) => client.from("dtx_machines").delete().eq("id", id)
      : (client: any) => client.from("dtx_machines").delete().eq("bgm_code", id);

    await executeSupabaseWrite(query);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- repair_requests ---
app.get("/api/repairs", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("repair_requests").select("*")
    );
    const sorted = ((data as any[]) || []).sort(
      (a: any, b: any) => new Date(b.created_at || b.req_date || 0).getTime() - new Date(a.created_at || a.req_date || 0).getTime()
    );
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/repairs", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("repair_requests").insert([payload]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/repairs/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const query = isUuid(id)
      ? (client: any) => client.from("repair_requests").update(req.body).eq("id", id).select("*").maybeSingle()
      : (client: any) => client.from("repair_requests").update(req.body).eq("bgm_code", id).select("*").maybeSingle();

    const data = await executeSupabaseWrite(query);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/repairs/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const query = isUuid(id)
      ? (client: any) => client.from("repair_requests").delete().eq("id", id)
      : (client: any) => client.from("repair_requests").delete().eq("bgm_code", id);

    await executeSupabaseWrite(query);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- supply_requests ---
app.get("/api/supplies", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("supply_requests").select("*")
    );
    const sorted = ((data as any[]) || []).sort(
      (a: any, b: any) => new Date(b.created_at || b.req_date || 0).getTime() - new Date(a.created_at || a.req_date || 0).getTime()
    );
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/supplies", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("supply_requests").insert([payload]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/supplies/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const data = await executeSupabaseWrite(client =>
      client.from("supply_requests").update(req.body).eq("id", id).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/supplies/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    await executeSupabaseWrite(client =>
      client.from("supply_requests").delete().eq("id", id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- qc_records ---
app.get("/api/qc-records", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("qc_records").select("*")
    );
    const sorted = ((data as any[]) || []).sort(
      (a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime()
    );
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/qc-records", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("qc_records").insert([payload]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/qc-records/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const data = await executeSupabaseWrite(client =>
      client.from("qc_records").update(req.body).eq("id", id).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/qc-records/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    await executeSupabaseWrite(client =>
      client.from("qc_records").delete().eq("id", id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- qc_lot_configs ---
app.get("/api/lot-configs", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("qc_lot_configs").select("*")
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/lot-configs", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("qc_lot_configs").upsert([req.body], { onConflict: "lot_number" }).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/lot-configs/:lotNumber", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("qc_lot_configs").update(req.body).eq("lot_number", req.params.lotNumber).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/lot-configs/:lotNumber", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseWrite(client =>
      client.from("qc_lot_configs").delete().eq("lot_number", req.params.lotNumber)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- eqa_records ---
app.get("/api/eqa-records", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("eqa_records").select("*")
    );
    const sorted = ((data as any[]) || []).sort(
      (a: any, b: any) => new Date(b.test_date || b.created_at || 0).getTime() - new Date(a.test_date || a.created_at || 0).getTime()
    );
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/eqa-records", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("eqa_records").insert([payload]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/eqa-records/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    const data = await executeSupabaseWrite(client =>
      client.from("eqa_records").update(req.body).eq("id", id).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/eqa-records/:id", checkDbConfig, async (req, res) => {
  try {
    const id = req.params.id;
    await executeSupabaseWrite(client =>
      client.from("eqa_records").delete().eq("id", id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- user_manuals ---
app.get("/api/manuals", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("user_manuals").select("*")
    );
    const filtered = ((data as any[]) || [])
      .filter((m: any) => !m.is_deleted)
      .sort((a: any, b: any) => new Date(b.created_at || b.upload_date || 0).getTime() - new Date(a.created_at || a.upload_date || 0).getTime());
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/manuals", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("user_manuals").insert([req.body]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/manuals/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("user_manuals").update(req.body).eq("id", req.params.id).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/manuals/:id", checkDbConfig, async (req, res) => {
  try {
    try {
      await executeSupabaseWrite(client =>
        client.from("user_manuals").update({ is_deleted: true }).eq("id", req.params.id)
      );
    } catch {
      await executeSupabaseWrite(client =>
        client.from("user_manuals").delete().eq("id", req.params.id)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- announcements ---
app.get("/api/announcements", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("announcements").select("*")
    );
    const filtered = ((data as any[]) || [])
      .filter((a: any) => !a.is_deleted)
      .sort((a: any, b: any) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) {
          return b.pinned ? 1 : -1;
        }
        return new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime();
      });
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/announcements", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("announcements").insert([req.body]).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/announcements/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("announcements").update(req.body).eq("id", req.params.id).select("*").maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/announcements/:id", checkDbConfig, async (req, res) => {
  try {
    try {
      await executeSupabaseWrite(client =>
        client.from("announcements").update({ is_deleted: true }).eq("id", req.params.id)
      );
    } catch {
      await executeSupabaseWrite(client =>
        client.from("announcements").delete().eq("id", req.params.id)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- daily_checklists (Quick Win & Staff Maintenance) ---
app.get("/api/daily-checklists", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("daily_checklists").select("*").order("date", { ascending: false })
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/daily-checklists", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("daily_checklists").insert([payload]).select().maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/daily-checklists/:id", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseWrite(client =>
      client.from("daily_checklists").delete().eq("id", req.params.id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- maintenance_logs ---
app.get("/api/maintenance-logs", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("maintenance_logs").select("*").order("date", { ascending: false })
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/maintenance-logs", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("maintenance_logs").insert([payload]).select().maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- strip_reagent_items ---
app.get("/api/strip-reagent-items", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("strip_reagent_items").select("*").order("received_date", { ascending: false })
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/strip-reagent-items", checkDbConfig, async (req, res) => {
  try {
    const payload = Array.isArray(req.body)
      ? req.body.map(cleanUuidPayload)
      : [cleanUuidPayload(req.body)];
    const data = await executeSupabaseWrite(client =>
      client.from("strip_reagent_items").insert(payload).select()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/strip-reagent-items/:id", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("strip_reagent_items").update(payload).eq("id", req.params.id).select().maybeSingle()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/strip-reagent-items/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("strip_reagent_items").delete().eq("id", req.params.id)
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- master_wards (Strictly queries public.master_wards for thai_name via dedicated public client) ---
app.get("/api/wards", checkDbConfig, async (req, res) => {
  try {
    const client = publicSupabase || supabase;
    if (!client) {
      console.warn("[SERVER master_wards DEBUG] Supabase client is not configured");
      return res.json([]);
    }

    console.log("[SERVER master_wards DEBUG] Fetching master_wards from schema: public...");
    let resData: any[] | null = null;
    const { data, error, status, statusText } = await client.from("master_wards").select("*");
    
    if (!error && Array.isArray(data) && data.length > 0) {
      console.log(`[SERVER master_wards DEBUG] select(*) SUCCESS: found ${data.length} records`);
      resData = data;
    } else {
      if (error) {
        console.warn(`[SERVER master_wards DEBUG] select(*) error from public.master_wards:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status,
          statusText
        });
      }
      // Fallback to explicitly querying thai_name if select * is restricted
      const { data: dThai, error: eThai, status: sThai } = await client.from("master_wards").select("thai_name");
      if (!eThai && Array.isArray(dThai) && dThai.length > 0) {
        console.log(`[SERVER master_wards DEBUG] select(thai_name) SUCCESS: found ${dThai.length} records`);
        resData = dThai;
      } else if (eThai) {
        console.warn(`[SERVER master_wards DEBUG] select(thai_name) error:`, {
          code: eThai.code,
          message: eThai.message,
          details: eThai.details,
          hint: eThai.hint,
          status: sThai
        });
      }
    }

    const list = (resData || [])
      .filter((w: any) => w && (w.thai_name || w.name || w.ward) && String(w.thai_name || w.name || w.ward).trim().length > 0)
      .map((w: any) => {
        const thaiName = String(w.thai_name || w.ward_name || w.name || w.ward || '').trim();
        const enName = String(w.en_name || w.ward_code || w.code || thaiName).trim();
        return {
          en_name: enName || thaiName,
          thai_name: thaiName || enName
        };
      })
      .sort((a: any, b: any) => a.thai_name.localeCompare(b.thai_name, 'th'));

    res.json(list);
  } catch (err: any) {
    console.error("[SERVER master_wards DEBUG] Exception while querying master_wards:", err?.message || err);
    res.json([]);
  }
});

// Helper to sanitize user object by stripping sensitive fields (passwords, hashes, pins)
const sanitizeUser = (u: any) => {
  if (!u) return null;
  const { password, pass_hash, password_hash, pin, secret, ...safeUser } = u;
  const rawName = safeUser.full_name || safeUser.fullname || safeUser.name || safeUser.display_name || safeUser.username || '';
  const rawPos = (safeUser.position || safeUser.pos || safeUser.job_title || safeUser.role_name || '').toString().replace(/[\r\n"']/g, '').trim();

  return {
    id: safeUser.id || rawName,
    username: safeUser.username || safeUser.email || '',
    full_name: rawName,
    email: safeUser.email || '',
    role: safeUser.role || 'user',
    position: rawPos,
    ward: safeUser.ward || '',
    is_active: safeUser.is_active !== false,
  };
};

// Helper to verify password on backend
const verifyUserPassword = (plainPass: string, storedHash: string): boolean => {
  if (!plainPass || !storedHash) return false;
  const trimmedPass = plainPass.trim();
  const trimmedHash = storedHash.trim();
  if (trimmedHash.startsWith('$2a$') || trimmedHash.startsWith('$2b$') || trimmedHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(trimmedPass, trimmedHash);
    } catch {
      return false;
    }
  }
  return trimmedPass === trimmedHash;
};

// --- dtx_system_users (Queries dtx_system.users table or public.dtx_system_users view securely) ---
app.get("/api/dtx-system-users", checkDbConfig, async (req, res) => {
  try {
    console.log("[SERVER dtx_system_users] Fetching users started...");
    
    let rawList: any[] = [];

    // 1. Try primary dtx_system.users table first (using dtx_system schema client)
    if (supabase) {
      const { data: dtxUsersData, error: dtxUsersErr } = await supabase.from("users").select("*");
      if (!dtxUsersErr && Array.isArray(dtxUsersData) && dtxUsersData.length > 0) {
        console.log(`[SERVER dtx_system_users] Primary dtx_system.users SUCCESS: found ${dtxUsersData.length} records`);
        rawList = dtxUsersData;
      }
    }

    // 2. Try public view dtx_system_users as fallback
    if (rawList.length === 0 && publicSupabase) {
      const { data: viewData, error: viewError } = await publicSupabase.from("dtx_system_users").select("*");
      if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
        console.log(`[SERVER dtx_system_users] View public.dtx_system_users SUCCESS: found ${viewData.length} records`);
        rawList = viewData;
      }
    }

    // 3. Try public.users table as third fallback
    if (rawList.length === 0 && publicSupabase) {
      const { data: pubUsersData, error: pubUsersError } = await publicSupabase.from("users").select("*");
      if (!pubUsersError && Array.isArray(pubUsersData) && pubUsersData.length > 0) {
        console.log(`[SERVER dtx_system_users] Table public.users SUCCESS: found ${pubUsersData.length} records`);
        rawList = pubUsersData;
      }
    }

    // 4. Try handover_sys.users as final resilient fallback
    if (rawList.length === 0 && publicSupabase) {
      const { data: hoData, error: hoError } = await publicSupabase.schema("handover_sys").from("users").select("*");
      if (!hoError && Array.isArray(hoData) && hoData.length > 0) {
        console.log(`[SERVER dtx_system_users] Table handover_sys.users SUCCESS: found ${hoData.length} records`);
        rawList = hoData;
      }
    }

    // Sanitize user list: strictly strip sensitive fields like passwords/hashes before returning to frontend
    const sanitizedList = rawList
      .filter((u: any) => u && u.is_active !== false)
      .map((u: any) => sanitizeUser(u))
      .filter(Boolean);

    res.json(sanitizedList);
  } catch (err: any) {
    console.error("[SERVER dtx_system_users] Exception while querying users:", err?.message || err);
    res.json([]);
  }
});

// --- Backend Verification Endpoint (/api/auth/verify-user) ---
// Verifies user on the server. If user is invalid, disabled, or password mismatch,
// returns 401/404 with NO user data sent back to frontend.
app.post("/api/auth/verify-user", checkDbConfig, async (req, res) => {
  try {
    const { userId, username, password } = req.body || {};

    if (!userId && !username) {
      return res.status(400).json({ success: false, error: "ไม่ได้ระบุข้อมูลผู้ใช้งานเพื่อตรวจสอบ" });
    }

    const client = publicSupabase || (supabase ? supabase.schema("public") : null);
    if (!client) {
      return res.status(503).json({ success: false, error: "ระบบฐานข้อมูลหลังบ้านไม่พร้อมใช้งาน" });
    }

    let userCandidate: any = null;

    // 1. Find candidate user on backend
    if (userId) {
      const { data: d1 } = await client.from("dtx_system_users").select("*").eq("id", userId).maybeSingle();
      if (d1) userCandidate = d1;
      
      if (!userCandidate) {
        const { data: d2 } = await client.from("users").select("*").eq("id", userId).maybeSingle();
        if (d2) userCandidate = d2;
      }

      if (!userCandidate) {
        const { data: d3 } = await client.schema("handover_sys").from("users").select("*").eq("id", userId).maybeSingle();
        if (d3) userCandidate = d3;
      }
    } else if (username) {
      const { data: d1 } = await client.from("dtx_system_users").select("*").or(`username.eq.${username},email.eq.${username}`).maybeSingle();
      if (d1) userCandidate = d1;

      if (!userCandidate) {
        const { data: d2 } = await client.from("users").select("*").or(`username.eq.${username},email.eq.${username}`).maybeSingle();
        if (d2) userCandidate = d2;
      }

      if (!userCandidate) {
        const { data: d3 } = await client.schema("handover_sys").from("users").select("*").or(`username.eq.${username},email.eq.${username}`).maybeSingle();
        if (d3) userCandidate = d3;
      }
    }

    // Check if user exists and is active
    if (!userCandidate || userCandidate.is_active === false) {
      console.warn(`[SERVER VERIFY USER] Verification FAILED for target: ${userId || username} (User not found or disabled)`);
      // REJECT: Return 401 with NO user data sent to frontend!
      return res.status(401).json({
        success: false,
        error: "ผู้ใช้งานไม่ถูกต้อง ไม่มีข้อมูลในระบบ หรือถูกระงับการใช้งาน"
      });
    }

    // Check password if provided
    if (password !== undefined && password !== null) {
      const storedPass = userCandidate.password || userCandidate.pass_hash || userCandidate.password_hash || "";
      const isPassValid = verifyUserPassword(password, storedPass);
      if (!isPassValid) {
        console.warn(`[SERVER VERIFY USER] Password mismatch for user: ${userCandidate.full_name || username}`);
        // REJECT: Return 401 with NO user data sent to frontend!
        return res.status(401).json({
          success: false,
          error: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง"
        });
      }
    }

    // SUCCESS: Return ONLY sanitized user profile (strictly no sensitive credentials)
    const sanitized = sanitizeUser(userCandidate);
    console.log(`[SERVER VERIFY USER] Backend successfully verified user: ${sanitized.full_name} (${sanitized.id})`);

    return res.json({
      success: true,
      user: sanitized
    });
  } catch (err: any) {
    console.error("[SERVER VERIFY USER] Exception:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: "เกิดข้อผิดพลาดในการตรวจสอบผู้ใช้ฝั่งเซิร์ฟเวอร์"
    });
  }
});

// --- LINE Notification Proxy ---
app.post("/api/notify/line", async (req, res) => {
  try {
    const { token, message } = req.body;
    const finalToken = (token || process.env.LINE_NOTIFY_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();

    if (!finalToken) {
      return res.status(400).json({ error: "ยังไม่มีการตั้งค่า LINE Token" });
    }

    const response = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${finalToken}`
      },
      body: new URLSearchParams({ message: message || "แจ้งเตือนจากระบบ DTX Management โรงพยาบาลสังขะ" })
    });

    const result = await response.json();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================================
// 3. Vite Middleware integration for SPA dev & prod hosting
// ==========================================================================

async function startServer() {
  // Vite middleware for development or Static for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
