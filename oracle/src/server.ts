import express from "express";

const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.post("/attest", (req, res) => {
  const { user, taskId } = req.body ?? {};
  if (!user || !taskId) {
    return res.status(400).json({
      error: "Missing user or taskId"
    });
  }

  // Placeholder payload for future oracle signature workflow
  return res.json({
    payload: Buffer.from(
      JSON.stringify({
        user,
        taskId,
        verified: false,
        issuedAt: Date.now()
      })
    ).toString("base64"),
    sig: "BASE64_SIGNATURE_PENDING"
  });
});

app.listen(PORT, () => {
  console.log(`Oracle service listening on http://localhost:${PORT}`);
});
