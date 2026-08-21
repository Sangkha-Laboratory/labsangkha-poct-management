import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";

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
      db: { schema: 'poct_system' },
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
  if (!supabase) {
    return res.status(503).json({ error: "ระบบฐานข้อมูล Supabase ยังไม่ได้กำหนดค่าฝั่งเซิร์ฟเวอร์ (SUPABASE_URL, SUPABASE_ANON_KEY)" });
  }
  next();
};

// Query helper for READ queries (strictly inside poct_system schema)
async function executeSupabaseQuery<T>(
  queryFn: (client: any) => Promise<{ data: T; error: any }>,
  fallbackValue?: T
): Promise<T> {
  if (!supabase) {
    return (fallbackValue ?? []) as unknown as T;
  }

  try {
    const poctClient = supabase.schema('poct_system');
    const { data: poctData, error: poctError } = await queryFn(poctClient);
    if (!poctError && poctData !== null && poctData !== undefined) {
      return poctData;
    }
    if (poctError) {
      console.warn("poct_system query notice:", poctError.message || poctError);
    }
  } catch (err: any) {
    console.warn("poct_system query exception:", err?.message || err);
  }

  return (fallbackValue ?? []) as unknown as T;
}

// Query helper for WRITE queries (strictly inside poct_system schema)
async function executeSupabaseWrite<T>(
  queryFn: (client: any) => Promise<{ data: T; error: any }>
): Promise<T> {
  if (!supabase) {
    throw new Error("Supabase client is not configured on server (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  try {
    const poctClient = supabase.schema('poct_system');
    const { data: poctData, error: poctError } = await queryFn(poctClient);
    if (!poctError && poctData !== null && poctData !== undefined) {
      return poctData;
    }
    if (poctError) {
      throw poctError;
    }
  } catch (err: any) {
    throw new Error(err?.message || "Failed to execute Supabase database write operation in poct_system schema");
  }

  throw new Error("Failed to execute Supabase database write operation in poct_system schema");
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
    res.json(sorted);
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

// --- master_wards (Queries public.master_wards first as central shared table) ---
app.get("/api/wards", checkDbConfig, async (req, res) => {
  try {
    let data: any[] = [];
    // 1. Try public.master_wards
    try {
      if (supabase) {
        const { data: publicWards, error } = await supabase.schema('public').from("master_wards").select("*");
        if (!error && Array.isArray(publicWards) && publicWards.length > 0) {
          data = publicWards;
        }
      }
    } catch (e) {
      console.warn("public.master_wards error:", e);
    }

    // 2. Fallback to poct_system.master_wards if public is empty
    if (!data || data.length === 0) {
      try {
        if (supabase) {
          const { data: poctWards, error } = await supabase.schema('poct_system').from("master_wards").select("*");
          if (!error && Array.isArray(poctWards) && poctWards.length > 0) {
            data = poctWards;
          }
        }
      } catch (e) {
        console.warn("poct_system.master_wards error:", e);
      }
    }

    const sorted = (data || []).sort((a: any, b: any) =>
      String(a.thai_name || a.name || a.ward || '').localeCompare(String(b.thai_name || b.name || b.ward || ''), 'th')
    );
    res.json(sorted);
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
