
import sgMail from '@sendgrid/mail';

interface EmailPayload {
    to: string;
    subject: string;
    body: string;
}

export async function sendEmail({ to, subject, body }: EmailPayload) {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || "tachikawa.loohcs@gmail.com";

    if (apiKey) {
        sgMail.setApiKey(apiKey);
        try {
            await sgMail.send({
                to,
                from: fromEmail,
                subject,
                text: body,
            });
            console.log(`[SENDGRID] Email sent to ${to}`);
            return { success: true };
        } catch (error) {
            console.error('[SENDGRID] Error sending email', error);
            return { success: false, error };
        }
    } else {
        // Mock Implementation for local dev or when API key is missing
        const timestamp = new Date().toISOString();
        console.log(`
=================[ MOCK EMAIL SERVICE ]=================
Time: ${timestamp}
To: ${to}
From: ${fromEmail} (Mock)
Subject: ${subject}
--------------------------------------------------------
${body}
========================================================
`);
        return { success: true };
    }
}
