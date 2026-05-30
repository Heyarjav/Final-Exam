import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth";


import { createClient } from "redis";
const client = createClient();
client.connect();
const marketingEmailSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

let notificationId = 1;

function createMarketingNotification(subject: string, message: string) {
  return {
    id: notificationId,
    to: "ALL" as const,
    template: "marketing-email" as const,
    service: "EMAIL" as const,
    priority: 2,
    variables: {
      title: subject,
      message,
    },
  };
}

export async function marketingEmail(req: AuthRequest, res: Response) {
  try {
    notificationId++;
    const body = marketingEmailSchema.parse(req.body);

    //TODO: Send notification to all users
    const notification = createMarketingNotification(body.subject, body.message);
    await client.lPush("Queue-1", JSON.stringify(notification));
    
    res.status(201).json({
      message: "Marketing email notification created",
      subject: body.subject,
      notification: notificationId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation failed", errors: error.flatten().fieldErrors });
      return;
    }

    res.status(500).json({ message: "Marketing email failed" });
  }
}
