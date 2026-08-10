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

// Helper to check database configuration
const checkDbConfig = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!supabase) {
    return res.status(503).send("ระบบฐานข้อมูล Supabase ยังไม่ได้กำหนดค่าฝั่งเซิร์ฟเวอร์ (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }
  next();
};

// Query helper that attempts poct_system schema first, then public schema fallback,
// and gracefully returns fallback values or empty arrays if table/schema is missing/not exposed.
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
    console.warn("public schema query attempt:", publicError?.message || publicError);
  } catch (err: any) {
    console.warn("public schema query exception:", err?.message || err);
  }

  // If both failed (e.g. table not found or schema not exposed in Supabase settings yet),
  // return fallbackValue (defaults to []) so the app can load gracefully with empty data
  return (fallbackValue ?? []) as unknown as T;
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
    // Try to query information_schema to see what tables are visible in 'public'
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
        .select('column_name')
        .eq('table_name', table);

    if (error) throw error;
    res.json({ table, columns: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================================
// 2. POCT System CRUD API Endpoints
// ==========================================================================

// --- dtx_machines ---
app.get("/api/machines", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("dtx_machines").select("*").order("bgm_code", { ascending: true })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.post("/api/machines", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("dtx_machines").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/machines/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("dtx_machines").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/machines/:id", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseQuery(client =>
      client.from("dtx_machines").delete().eq("id", req.params.id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
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
    res.status(500).send(err.message);
  }
});

app.post("/api/repairs", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("repair_requests").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/repairs/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("repair_requests").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/repairs/:id", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseQuery(client =>
      client.from("repair_requests").delete().eq("id", req.params.id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
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
    res.status(500).send(err.message);
  }
});

app.post("/api/supplies", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("supply_requests").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/supplies/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("supply_requests").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/supplies/:id", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseQuery(client =>
      client.from("supply_requests").delete().eq("id", req.params.id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
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
    res.status(500).send(err.message);
  }
});

app.post("/api/qc-records", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("qc_records").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/qc-records/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("qc_records").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/qc-records/:id", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseQuery(client =>
      client.from("qc_records").delete().eq("id", req.params.id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
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
    res.status(500).send(err.message);
  }
});

app.post("/api/lot-configs", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("qc_lot_configs").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/lot-configs/:lotNumber", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("qc_lot_configs").update(req.body).eq("lot_number", req.params.lotNumber).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/lot-configs/:lotNumber", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseQuery(client =>
      client.from("qc_lot_configs").delete().eq("lot_number", req.params.lotNumber)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
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
    res.status(500).send(err.message);
  }
});

app.post("/api/eqa-records", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("eqa_records").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/eqa-records/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("eqa_records").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/eqa-records/:id", checkDbConfig, async (req, res) => {
  try {
    await executeSupabaseQuery(client =>
      client.from("eqa_records").delete().eq("id", req.params.id)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// --- user_manuals ---
app.get("/api/manuals", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("user_manuals").select("*").order("upload_date", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.post("/api/manuals", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("user_manuals").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/manuals/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("user_manuals").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/manuals/:id", checkDbConfig, async (req, res) => {
  try {
    try {
      await executeSupabaseQuery(client =>
        client.from("user_manuals").update({ is_deleted: true }).eq("id", req.params.id)
      );
    } catch {
      await executeSupabaseQuery(client =>
        client.from("user_manuals").delete().eq("id", req.params.id)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// --- announcements ---
app.get("/api/announcements", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("announcements").select("*").order("date", { ascending: false })
    );
    res.json(data || []);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.post("/api/announcements", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("announcements").insert([req.body]).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.put("/api/announcements/:id", checkDbConfig, async (req, res) => {
  try {
    const data = await executeSupabaseQuery(client =>
      client.from("announcements").update(req.body).eq("id", req.params.id).select("*").single()
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.delete("/api/announcements/:id", checkDbConfig, async (req, res) => {
  try {
    try {
      await executeSupabaseQuery(client =>
        client.from("announcements").update({ is_deleted: true }).eq("id", req.params.id)
      );
    } catch {
      await executeSupabaseQuery(client =>
        client.from("announcements").delete().eq("id", req.params.id)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});


// --- master_wards ---
app.get("/api/wards", checkDbConfig, async (req, res) => {
  try {
    const { data, error } = await supabase.from("master_wards").select("*").order("thai_name", { ascending: true });
    if (error) {
      console.error("Supabase API Wards Error:", error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data || []);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// ==========================================================================
// 3. Vite Middleware integration for SPA dev & prod hosting
// ==========================================================================

async function startServer() {
  // API routes must be defined before Vite/Static middleware
  // (All current app.get/post/put/delete routes are already defined above)

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
