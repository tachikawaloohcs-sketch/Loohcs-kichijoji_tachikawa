

interface EmailPayload {
    to: string;
    subject: string;
    body: string;
}

export async function sendEmail({ to, subject, body }: EmailPayload) {
    // In a real application, you would use Resend, SendGrid, or Nodemailer here.
    // For now, we log to stdout so it appears in Cloud Run logs.

    const timestamp = new Date().toISOString();
    console.log(`
=================[ MOCK EMAIL SERVICE ]=================
Time: ${timestamp}
To: ${to}
Subject: ${subject}
--------------------------------------------------------
${body}
========================================================
`);

    return { success: true };
}
