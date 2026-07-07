/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // API: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API: Send Email Notification
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, recipientName } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields (to, subject, html)" });
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    // Gracefully handle missing SMTP configuration
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.log("\n📬 [EMAIL NOTIFICATION PREVIEW] (SMTP not configured yet)");
      console.log(`To: ${recipientName || 'Member'} <${to}>`);
      console.log(`Subject: ${subject}`);
      console.log(`--------------------------------------------------`);
      console.log(`Configure SMTP credentials in the workspace Settings to deliver real emails!`);
      console.log(`Required keys: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM`);
      console.log(`--------------------------------------------------\n`);

      return res.json({
        success: true,
        mocked: true,
        message: "Email queued successfully in local development sandbox (SMTP credentials not yet configured in Settings)."
      });
    }

    try {
      // Lazy initialization of nodemailer transport
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: SMTP_PORT === "465", // true for port 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"VibeCheck Workflow Hub" <${SMTP_FROM || SMTP_USER}>`,
        to: to,
        subject,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ Email successfully sent to ${to}: ${info.messageId}`);
      
      return res.json({
        success: true,
        messageId: info.messageId,
        message: "Real email notification sent successfully."
      });
    } catch (error: any) {
      console.error("❌ Failed to send email via SMTP:", error);
      return res.status(500).json({
        error: "SMTP Dispatch Error",
        details: error.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
