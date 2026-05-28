
import { createClient } from "redis";
const service = createClient();
service.connect();

import { renderTemplate } from ".";
import type { RenderTemplateOptions, TemplateName } from ".";

import { Resend } from "resend";
const resend = new Resend('re_Saghds4z_DZKvx89phYMXuQ7wFvy7VvS5');
type Data = {
    id: number,
    user: number,
    amount: number,
    email: string,
    template: string,
    service: string,
    priority: number
}
async function sendEmail(info: Data) {
    const payload: RenderTemplateOptions = {
        template: info.template,
        variables: {
            username: info.email,
            amount: info.amount
        }
    }
    const html = await renderTemplate(payload);
    //send email
    await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [info.email],
        subject: 'Hello World',
        html: html
    });
}

export async function BackendListner() {
    while (true) {
        const response = await service.brPop("Queue-1", 0);
        if (!response) {
            continue
        }
        const data = JSON.parse(response.element);
        sendEmail(data);
    }
}

BackendListner();