import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Send staff invite email
   * In production, replace with actual email sending (e.g., SendGrid, AWS SES, etc.)
   */
  sendStaffInviteEmail(email: string, displayName: string, inviteToken: string): void {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const inviteLink = `${frontendUrl}/staff/accept-invite?token=${inviteToken}`;

    // TODO: Implement actual email sending
    // eslint-disable-next-line no-console
    console.log(`
      [EmailService] Sending invite email:
      To: ${email}
      Link: ${inviteLink}
      Display Name: ${displayName}
    `);

    // Placeholder: In production, use a mailer service like nodemailer or SendGrid
    // await this.mailerService.sendMail({
    //   to: email,
    //   subject: 'Staff Invite',
    //   template: 'staff-invite',
    //   context: {
    //     displayName,
    //     inviteLink,
    //   },
    // });
  }
}
