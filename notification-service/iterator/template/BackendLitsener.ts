
import { createClient } from "redis";
const notificationQueue = createClient();
const emailQueue = createClient();
const emailSender = createClient();

await Promise.all([
    notificationQueue.connect(),
    emailQueue.connect(),
    emailSender.connect(),
]);

import { renderTemplate } from ".";
import type { RenderTemplateOptions, TemplateName } from ".";
import { prisma } from "../db";
import { Resend } from "resend";
const resend = new Resend('re_Saghds4z_DZKvx89phYMXuQ7wFvy7VvS5');

const NOTIFICATION_QUEUE = "Queue-1";
const EMAIL_QUEUES = ["Email-Queue-0", "Email-Queue-1", "Email-Queue-2"] as const;

type NotificationJob = {
    id: number;
    to: string | "ALL";
    template: TemplateName;
    service: "EMAIL";
    priority: number;
    variables: Record<string, string | number>;
};

type EmailJob = {
    to: string;
    subject: string;
    html: string;
};

function getSubject(info: NotificationJob) {
    if (info.template === "signup-success") {
        return "Signup successful";
    }

    if (info.template === "wallet-onramp-success") {
        return "Wallet onramp successful";
    }

    return String(info.variables.title ?? "Marketing email");
}

function getEmailQueue(priority: number) {
    return EMAIL_QUEUES[priority] ?? "Email-Queue-2";
}

async function enqueueEmail(to: string, payload: RenderTemplateOptions, subject: string, priority: number) {
    const html = await renderTemplate(payload);
    const emailJob: EmailJob = {
        to,
        subject,
        html,
    };

    await emailQueue.lPush(getEmailQueue(priority), JSON.stringify(emailJob));
}

async function enqueueEmails(info: NotificationJob) {
    if (info.to === "ALL") {
        const users = await prisma.user.findMany({
            select: {
                email: true,
            },
        });

        for (const user of users) {
            await enqueueEmail(user.email, {
                template: info.template,
                variables: {
                    ...info.variables,
                    username: user.email,
                },
            }, getSubject(info), info.priority);
        }

        return;
    }

    await enqueueEmail(info.to, {
        template: info.template,
        variables: info.variables,
    }, getSubject(info), info.priority);
}

async function sendEmail(info: EmailJob) {
    await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [info.to],
        subject: info.subject,
        html: info.html
    });
}

async function createEmailJobs() {
    while (true) {
        const response = await notificationQueue.brPop(NOTIFICATION_QUEUE, 0);
        if (!response) { 
            continue
        }
        const info = JSON.parse(response.element) as NotificationJob;
        await enqueueEmails(info);
    }
}

async function sendQueuedEmails() {
    while (true) {
        const response = await emailSender.brPop([...EMAIL_QUEUES], 0);
        if (!response) {
            continue;
        }

        const info = JSON.parse(response.element) as EmailJob;
        await sendEmail(info);
    }
}

export async function BackendListner() {
    await Promise.all([
        createEmailJobs(),
        sendQueuedEmails(),
    ]);
}
