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
  ? createClient(supabaseUrl, supabaseAnonKey)
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

// Query helper for READ queries (with fallback)
async function executeSupabaseQuery<T>(
  queryFn: (client: any) => Promise<{ data: T; error: any }>,
  fallbackValue?: T
): Promise<T> {
  if (!supabase) {
    return (fallbackValue ?? []) as unknown as T;
  }

  // Attempt 1: Query using poct_system schema
  try {
    const poctClient = supabase.schema('poct_system');
    const { data: poctData, error: poctError } = await queryFn(poctClient);
    if (!poctError && poctData !== null && poctData !== undefined) {
      return poctData;
    }
  } catch (err: any) {
    console.warn("poct_system schema query attempt:", err?.message || err);
  }

  // Attempt 2: Fallback to default (public) schema
  try {
    const { data: publicData, error: publicError } = await queryFn(supabase);
    if (!publicError && publicData !== null && publicData !== undefined) {
      return publicData;
    }
  } catch (err: any) {
    console.warn("public schema query exception:", err?.message || err);
  }

  return (fallbackValue ?? []) as unknown as T;
}

// Query helper for WRITE queries (insert, update, delete) that throws real errors on failure
async function executeSupabaseWrite<T>(
  queryFn: (client: any) => Promise<{ data: T; error: any }>
): Promise<T> {
  if (!supabase) {
    throw new Error("Supabase client is not configured on server (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  let lastError: any = null;

  // Attempt 1: poct_system schema
  try {
    const poctClient = supabase.schema('poct_system');
    const { data: poctData, error: poctError } = await queryFn(poctClient);
    if (!poctError && poctData !== null && poctData !== undefined) {
      return poctData;
    }
    lastError = poctError;
  } catch (err: any) {
    lastError = err;
  }

  // Attempt 2: public schema fallback
  try {
    const { data: publicData, error: publicError } = await queryFn(supabase);
    if (!publicError && publicData !== null && publicData !== undefined) {
      return publicData;
    }
    lastError = publicError || lastError;
  } catch (err: any) {
    lastError = err || lastError;
  }

  throw new Error(lastError?.message || "Failed to execute Supabase database write operation");
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
      client.from("dtx_machines").select("*").order("created_at", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/machines", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("dtx_machines").insert([payload]).select("*").single()
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
      ? (client: any) => client.from("dtx_machines").update(req.body).eq("id", id).select("*").single()
      : (client: any) => client.from("dtx_machines").update(req.body).eq("bgm_code", id).select("*").single();

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
      client.from("repair_requests").select("*").order("created_at", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/repairs", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("repair_requests").insert([payload]).select("*").single()
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
      ? (client: any) => client.from("repair_requests").update(req.body).eq("id", id).select("*").single()
      : (client: any) => client.from("repair_requests").update(req.body).eq("bgm_code", id).select("*").single();

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
      client.from("supply_requests").select("*").order("created_at", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/supplies", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("supply_requests").insert([payload]).select("*").single()
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
      client.from("supply_requests").update(req.body).eq("id", id).select("*").single()
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
      client.from("qc_records").select("*").order("date", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/qc-records", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("qc_records").insert([payload]).select("*").single()
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
      client.from("qc_records").update(req.body).eq("id", id).select("*").single()
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
      client.from("qc_lot_configs").upsert([req.body], { onConflict: "lot_number" }).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/lot-configs/:lotNumber", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("qc_lot_configs").update(req.body).eq("lot_number", req.params.lotNumber).select("*").single()
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
      client.from("eqa_records").select("*").order("test_date", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/eqa-records", checkDbConfig, async (req, res) => {
  try {
    const payload = cleanUuidPayload(req.body);
    const data = await executeSupabaseWrite(client =>
      client.from("eqa_records").insert([payload]).select("*").single()
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
      client.from("eqa_records").update(req.body).eq("id", id).select("*").single()
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
      client.from("user_manuals").select("*").eq("is_deleted", false).order("created_at", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/manuals", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("user_manuals").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/manuals/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("user_manuals").update(req.body).eq("id", req.params.id).select("*").single()
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
      client.from("announcements").select("*").eq("is_deleted", false).order("pinned", { ascending: false }).order("date", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/announcements", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("announcements").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/announcements/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseWrite(client =>
      client.from("announcements").update(req.body).eq("id", req.params.id).select("*").single()
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

// --- master_wards ---
app.get("/api/wards", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("master_wards").select("*").order("thai_name", { ascending: true })
    );
    res.json(data || []);
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
