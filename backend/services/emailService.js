/**
 * Email Service
 * Centralized email functionality for the application
 * All emails are sent to actual recipients from database - NO hardcoded emails
 * 
 * PRODUCTION: Uses SendGrid API (HTTP-based, works on Render free tier)
 * DEVELOPMENT: Uses Nodemailer SMTP (direct connection)
 */

const nodemailer = require('nodemailer');

// ================= SENDGRID API SETUP =================
let sgMail = null;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const USE_SENDGRID = !!SENDGRID_API_KEY;
let sendgridInitError = null;

console.log('📧 [STARTUP] SENDGRID_API_KEY present:', !!SENDGRID_API_KEY);

if (USE_SENDGRID) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('📧 ✅ SendGrid API initialized successfully');
  } catch (err) {
    sendgridInitError = err.message;
    console.error('📧 ❌ Failed to initialize SendGrid:', err.message);
    console.error('📧 ❌ Make sure @sendgrid/mail package is installed: npm install @sendgrid/mail');
  }
} else {
  console.log('📧 ⚠️ SENDGRID_API_KEY not set - will use SMTP only');
}

let transporter = null;
let initializationAttempted = false;

// ================= STARTUP VALIDATION =================
// CRITICAL: Check FRONTEND_URL at module load time
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!FRONTEND_URL) {
  console.error('\n========== CRITICAL EMAIL CONFIG ERROR ==========');
  console.error('📧 ❌ FRONTEND_URL is NOT SET!');
  console.error('📧 ❌ Password reset links will NOT work!');
  console.error('📧 ❌ Please set FRONTEND_URL in environment variables');
  console.error('📧 ❌ Example: FRONTEND_URL=https://your-app.vercel.app');
  console.error('=================================================\n');
} else if (isProduction && (FRONTEND_URL.includes('localhost') || FRONTEND_URL.includes('127.0.0.1'))) {
  console.error('\n========== CRITICAL EMAIL CONFIG ERROR ==========');
  console.error('📧 ❌ FRONTEND_URL contains localhost in PRODUCTION!');
  console.error('📧 ❌ Current value:', FRONTEND_URL);
  console.error('📧 ❌ This will cause broken email links!');
  console.error('📧 ❌ Fix FRONTEND_URL in Render environment variables');
  console.error('=================================================\n');
} else {
  console.log('📧 ✅ FRONTEND_URL configured:', FRONTEND_URL);
}

/**
 * Get the configured frontend URL (for password reset links, etc.)
 */
const getFrontendUrl = () => FRONTEND_URL;

/**
 * Initialize the email transporter with cloud-compatible settings
 * PRODUCTION: Transporter is created if credentials exist - NO verify() call
 * Gmail SMTP on Render works even if verification fails or times out
 */
const initializeTransporter = () => {
  // Prevent multiple initializations
  if (initializationAttempted && transporter) {
    console.log('📧 Email transporter already initialized');
    return transporter;
  }
  initializationAttempted = true;

  // Check if credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 ⚠️ Email credentials not configured - email service disabled');
    console.log('📧 ⚠️ Set EMAIL_USER and EMAIL_PASS in environment variables');
    return null;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  console.log('📧 [INIT] Creating email transporter...');
  console.log('📧 [INIT] Environment:', isProduction ? 'PRODUCTION' : 'development');
  console.log('📧 [INIT] EMAIL_USER:', process.env.EMAIL_USER.substring(0, 5) + '***');

  transporter = nodemailer.createTransport({

  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // 587 ki always false

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS?.replace(/\s/g, "")
  },

  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,

  tls: {
    rejectUnauthorized: false
  }
});



  console.log('📧 [INIT] ✅ Email transporter CREATED - ready for sendMail()');

  // PRODUCTION: Skip verify() entirely - it often fails on Render but sendMail works
  if (isProduction) {
    console.log('📧 Skipping email transporter verification in production');
    return transporter;
  }

  // DEVELOPMENT ONLY: Async verification for debugging - does not affect sending
  const verifyTransporter = async () => {
    try {
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 10000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log('📧 [INIT] ✅ Dev verification successful');
    } catch (error) {
      console.log('📧 [INIT] ⚠️ Dev verification failed (non-blocking):', error.message);
    }
  };

  verifyTransporter();
  return transporter;
};

/**
 * Get the transporter instance
 */
const getTransporter = () => transporter;

/**
 * Get admin email from environment (NOT hardcoded)
 */
const getAdminEmail = () => process.env.ADMIN_EMAIL || null;

/**
 * Unified Email Sender - Uses SendGrid API (production) or Nodemailer (development)
 * @param {object} options - { to, subject, html, from }
 * @returns {object} - { success, messageId, error }
 */
const sendEmailUnified = async (options) => {
  const { to, subject, html, from } = options;
  const fromEmail = from || process.env.EMAIL_USER || 'noreply@complaint-portal.com';
  
  console.log('📧 [UNIFIED] Starting email send...');
  console.log('📧 [UNIFIED] USE_SENDGRID:', USE_SENDGRID);
  console.log('📧 [UNIFIED] sgMail exists:', !!sgMail);
  console.log('📧 [UNIFIED] sendgridInitError:', sendgridInitError || 'none');
  
  // TRY SENDGRID FIRST (for production on Render)
  if (USE_SENDGRID && sgMail) {
    try {
      console.log('📧 [SENDGRID] Sending via SendGrid API...');
      console.log('📧 [SENDGRID] To:', to);
      console.log('📧 [SENDGRID] Subject:', subject);
      console.log('📧 [SENDGRID] From:', fromEmail);
      
      const msg = {
        to: to,
        from: fromEmail, // Must be verified sender in SendGrid
        subject: subject,
        html: html,
      };
      
      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'] || 'sendgrid-' + Date.now();
      
      console.log('📧 ✅ [SENDGRID] Email sent! Status:', response[0]?.statusCode);
      console.log('📧 ✅ [SENDGRID] Message ID:', messageId);
      return { success: true, messageId: messageId, method: 'sendgrid' };
    } catch (err) {
      console.error('📧 ❌ [SENDGRID] Failed:', err.message);
      if (err.response) {
        console.error('📧 ❌ [SENDGRID] Response body:', JSON.stringify(err.response.body));
      }
      // Fall through to nodemailer attempt
    }
  } else {
    console.log('📧 [UNIFIED] Skipping SendGrid - USE_SENDGRID:', USE_SENDGRID, 'sgMail:', !!sgMail);
  }
  
  // FALLBACK TO NODEMAILER (for local development)
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    initializeTransporter();
  }
  
  if (transporter) {
    try {
      console.log('📧 [SMTP] Sending via Nodemailer...');
      const info = await transporter.sendMail({
        from: `"Complaint Portal" <${fromEmail}>`,
        to: to,
        subject: subject,
        html: html,
      });
      console.log('📧 ✅ [SMTP] Email sent! ID:', info.messageId);
      return { success: true, messageId: info.messageId, method: 'smtp' };
    } catch (err) {
      console.error('📧 ❌ [SMTP] Failed:', err.message);
      return { success: false, error: err.message, method: 'smtp' };
    }
  }
  
  console.error('📧 ❌ No email method available');
  return { success: false, error: 'No email service configured', method: 'none' };
};

/**
 * Send Complaint Submission Confirmation Email to User
 * @param {object} complaint - Complaint object with user email
 */
const sendComplaintSubmissionEmail = async (complaint) => {
  console.log('\n📧 ========== SUBMISSION EMAIL START ==========');
  console.log('📧 [SUBMISSION] Complaint ID:', complaint?.id);
  console.log('📧 [SUBMISSION] Recipient:', complaint?.email || 'NONE');

  if (!complaint?.email) {
    console.error('📧 ❌ [SUBMISSION] No recipient email');
    return false;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #3b82f6;">
        <h2 style="color: #1d4ed8; margin: 0;">📝 Complaint Submitted Successfully</h2>
      </div>
      
      <p>Dear ${complaint.name || 'User'},</p>
      
      <p>Your complaint has been successfully submitted and is now being reviewed by our team.</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Complaint ID:</strong> #${complaint.id}</p>
        <p><strong>Category:</strong> ${complaint.category}</p>
        <p><strong>Priority:</strong> <span style="text-transform: uppercase;">${complaint.priority}</span></p>
        <p><strong>Status:</strong> <span style="color: #3b82f6; font-weight: bold;">NEW</span></p>
      </div>
      
      <div style="margin: 20px 0;">
        <h3>Description:</h3>
        <p style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          ${complaint.description}
        </p>
      </div>
      
      <p>You will receive an email notification when your complaint is resolved.</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      
      <p style="color: #6b7280; font-size: 14px;">
        Thank you for using our Complaint Portal.
      </p>
    </div>
  `;

  const result = await sendEmailUnified({
    to: complaint.email,
    subject: `📝 Complaint #${complaint.id} Submitted Successfully`,
    html: html
  });

  console.log('📧 ========== SUBMISSION EMAIL END ==========\n');
  return result.success;
};

/**
 * Send Escalation Email to Admin
 * @param {object} complaint - Complaint object
 * @param {number} hoursOverdue - Hours past SLA
 */
const sendEscalationEmail = async (complaint, hoursOverdue) => {
  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [ESCALATION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.log('📧 ⚠️ No transporter - skipping escalation notification');
    return false;
  }

  // Get admin email from environment - NOT hardcoded
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    console.log('📧 ⚠️ ADMIN_EMAIL not configured - skipping escalation notification');
    return false;
  }

  try {
    const problemImageSection = complaint.problem_image_url
      ? `<p><strong>Problem Image:</strong></p>
         <img src="${complaint.problem_image_url}" alt="Problem" style="max-width: 400px; border-radius: 8px; border: 2px solid #ef4444;" />`
      : '<p><em>No image attached</em></p>';

    const userEmailSection = complaint.is_anonymous || !complaint.email
      ? '<p><strong>User:</strong> <em>Anonymous</em></p>'
      : `<p><strong>User Email:</strong> <a href="mailto:${complaint.email}">${complaint.email}</a></p>`;

    const mailOptions = {
      from: `"Complaint Portal - URGENT" <${process.env.EMAIL_USER}>`,
      to: adminEmail,  // Send to configured admin email
      subject: `🚨 ESCALATION: Complaint #${complaint.id} - ${complaint.priority.toUpperCase()} Priority`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 3px solid #ef4444;">
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin: 0;">🚨 SLA BREACH - ESCALATION ALERT</h2>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Priority:</strong> 
              <span style="color: ${complaint.priority === 'high' ? '#dc2626' : complaint.priority === 'medium' ? '#f59e0b' : '#22c55e'}; font-weight: bold; text-transform: uppercase;">
                ${complaint.priority}
              </span>
            </p>
            <p><strong>Current Status:</strong> ${complaint.status}</p>
            <p><strong>Escalation Level:</strong> ${complaint.escalation_level || 1}</p>
            <p><strong>Hours Pending:</strong> <span style="color: #dc2626; font-weight: bold;">${hoursOverdue} hours overdue</span></p>
            ${userEmailSection}
          </div>

          <div style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="background-color: #fff7ed; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              ${complaint.description}
            </p>
          </div>
          
          ${problemImageSection}
          
          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ef4444;" />
          
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px;">
            <p style="color: #dc2626; font-weight: bold; margin: 0;">
              ⚠️ IMMEDIATE ACTION REQUIRED - This complaint has exceeded its SLA limit.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 ✅ Escalation email sent to admin: ${adminEmail}`);
    console.log('📧 Message ID:', info.messageId);
    return true;
  } catch (err) {
    console.error(`📧 ❌ Failed to send escalation email:`, err.message);
    return false;
  }
};

/**
 * Send Resolution Email to User (Enhanced version)
 * @param {object} complaint - Complaint object (must have .email resolved from users table)
 */
const sendResolutionEmail = async (complaint) => {
  console.log('\n📧 ========== RESOLUTION EMAIL START ==========');
  console.log('📧 [RESOLUTION] Email type: COMPLAINT_RESOLVED');
  console.log('📧 [RESOLUTION] Complaint ID:', complaint?.id);
  console.log('📧 [RESOLUTION] Recipient email:', complaint?.email || 'NONE');
  console.log('📧 [RESOLUTION] User ID:', complaint?.user_id || 'NONE');
  console.log('📧 [RESOLUTION] problem_image_url:', complaint?.problem_image_url || 'NONE');
  console.log('📧 [RESOLUTION] resolved_image_url:', complaint?.resolved_image_url || 'NONE');
  console.log('📧 [RESOLUTION] resolution_message:', complaint?.resolution_message ? 'Present' : 'NONE');
  console.log('📧 [RESOLUTION] Transporter ready:', !!transporter);

  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [RESOLUTION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.error('📧 ❌ [RESOLUTION] Transporter is NULL - cannot send email');
    console.error('📧 ❌ [RESOLUTION] Check EMAIL_USER and EMAIL_PASS in environment');
    console.log('📧 ========== RESOLUTION EMAIL END (FAILED) ==========\n');
    return false;
  }

  if (!complaint.email) {
    console.error('📧 ❌ [RESOLUTION] No recipient email - cannot send');
    console.error('📧 ❌ [RESOLUTION] Complaint may be anonymous or email not resolved from users table');
    console.log('📧 ========== RESOLUTION EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  try {
    const problemImageSection = complaint.problem_image_url
      ? `<div style="margin: 20px 0;">
           <h3 style="color: #dc2626;">❌ BEFORE (Problem):</h3>
           <img src="${complaint.problem_image_url}" alt="Problem" style="max-width: 400px; border-radius: 8px; border: 2px solid #ef4444;" />
         </div>`
      : '';

    const resolvedImageSection = complaint.resolved_image_url
      ? `<div style="margin: 20px 0;">
           <h3 style="color: #22c55e;">✅ AFTER (Resolved):</h3>
           <img src="${complaint.resolved_image_url}" alt="Resolution" style="max-width: 400px; border-radius: 8px; border: 2px solid #22c55e;" />
         </div>`
      : '';

    // Calculate resolution time
    const createdAt = new Date(complaint.created_at);
    const resolvedAt = complaint.resolved_at ? new Date(complaint.resolved_at) : new Date();
    const resolutionHours = Math.floor((resolvedAt - createdAt) / (1000 * 60 * 60));
    const resolutionDays = Math.floor(resolutionHours / 24);
    const remainingHours = resolutionHours % 24;
    const resolutionTimeText = resolutionDays > 0 
      ? `${resolutionDays} day(s) and ${remainingHours} hour(s)`
      : `${resolutionHours} hour(s)`;

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: complaint.email,
      subject: `✅ Your Complaint #${complaint.id} Has Been Resolved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #22c55e;">
            <h2 style="color: #22c55e; margin: 0;">✅ Your Complaint Has Been Resolved</h2>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">RESOLVED</span></p>
            <p><strong>Resolution Time:</strong> ${resolutionTimeText}</p>
          </div>
          
          ${complaint.resolution_message ? `
          <div style="margin: 20px 0;">
            <h3>📝 Resolution Message:</h3>
            <p style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
              ${complaint.resolution_message}
            </p>
          </div>
          ` : ''}
          
          ${problemImageSection}
          ${resolvedImageSection}
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for using our Complaint Portal. If you have any further questions or concerns, please don't hesitate to submit a new complaint or reach out to us.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [RESOLUTION] Email SENT successfully');
    console.log('📧 ✅ [RESOLUTION] Recipient:', complaint.email);
    console.log('📧 ✅ [RESOLUTION] Message ID:', info.messageId);
    console.log('📧 ========== RESOLUTION EMAIL END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [RESOLUTION] Email FAILED');
    console.error('📧 ❌ [RESOLUTION] Recipient:', complaint.email);
    console.error('📧 ❌ [RESOLUTION] Error:', err.message);
    console.log('📧 ========== RESOLUTION EMAIL END (FAILED) ==========\n');
    return false;
  }
};

/**
 * Send Email Verification Email
 * @param {string} email - User email
 * @param {string} token - Verification token
 */
const sendVerificationEmail = async (email, token) => {
  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [VERIFICATION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.log('📧 ⚠️ No transporter - skipping verification email');
    return false;
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL;
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL environment variable is missing. Please set it in your .env file for verification links to work.');
    }
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '📧 Verify Your Email - Complaint Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">Verify Your Email Address</h2>
          
          <p>Thank you for registering with the Complaint Portal. Please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link in your browser:<br>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            This link will expire in 24 hours.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 ✅ Verification email sent to: ${email}`);
    return true;
  } catch (err) {
    console.error(`📧 ❌ Failed to send verification email to ${email}:`, err.message);
    return false;
  }
};

/**
 * Send Password Reset Email
 * @param {string} email - User email (from database)
 * @param {string} name - User name
 * @param {string} resetUrl - Password reset URL with token (MUST use FRONTEND_URL)
 * @param {number} expiryMinutes - Token expiry in minutes (default 15)
 */
const sendPasswordResetEmail = async (email, name, resetUrl, expiryMinutes = 15) => {
  console.log('\n📧 ========== PASSWORD RESET EMAIL START ==========');
  console.log('📧 [PASSWORD RESET] Recipient:', email);
  console.log('📧 [PASSWORD RESET] Reset URL:', resetUrl);
  
  // CRITICAL: Validate reset URL is not localhost in production
  if (isProduction && resetUrl && (resetUrl.includes('localhost') || resetUrl.includes('127.0.0.1'))) {
    console.error('📧 ❌ [PASSWORD RESET] BLOCKING: Reset URL contains localhost in production!');
    return false;
  }

  // Validate email parameter
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('📧 ❌ [PASSWORD RESET] Invalid email address:', email);
    return false;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f59e0b;">Password Reset Request</h2>
      
      <p>Hi ${name || 'User'},</p>
      
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}"
           style="background-color: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        Or copy and paste this link in your browser:<br>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          ⚠️ This link will expire in <strong>${expiryMinutes} minutes</strong>.<br>
          This link can only be used once.<br>
          If you didn't request this reset, you can safely ignore this email.
        </p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
      
      <p style="color: #6b7280; font-size: 12px;">
        For security, this request was received from your account. If you did not make this request, please secure your account immediately.
      </p>
    </div>
  `;

  const result = await sendEmailUnified({
    to: email,
    subject: '🔐 Password Reset Request - Complaint Portal',
    html: html
  });

  console.log('📧 ========== PASSWORD RESET EMAIL END ==========\n');
  return result.success;
};

/**
 * Send Status Change Email to User
 * Called when complaint status changes to 'under-review'
 * @param {object} complaint - Complaint object (must have .email resolved from users table)
 * @param {string} newStatus - New status value
 */
const sendStatusChangeEmail = async (complaint, newStatus) => {
  console.log('\n📧 ========== STATUS CHANGE EMAIL START ==========');
  console.log('📧 [STATUS CHANGE] Email type: STATUS_CHANGE');
  console.log('📧 [STATUS CHANGE] Complaint ID:', complaint?.id);
  console.log('📧 [STATUS CHANGE] Recipient email:', complaint?.email || 'NONE');
  console.log('📧 [STATUS CHANGE] User ID:', complaint?.user_id || 'NONE');
  console.log('📧 [STATUS CHANGE] New Status:', newStatus);
  console.log('📧 [STATUS CHANGE] Transporter ready:', !!transporter);

  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [STATUS CHANGE] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.error('📧 ❌ [STATUS CHANGE] Transporter is NULL - cannot send email');
    console.error('📧 ❌ [STATUS CHANGE] Check EMAIL_USER and EMAIL_PASS in environment');
    console.log('📧 ========== STATUS CHANGE EMAIL END (FAILED) ==========\n');
    return false;
  }

  if (!complaint?.email) {
    console.error('📧 ❌ [STATUS CHANGE] No recipient email - cannot send');
    console.error('📧 ❌ [STATUS CHANGE] Complaint may be anonymous or email not resolved from users table');
    console.log('📧 ========== STATUS CHANGE EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  // Only send for under-review status (resolved has its own email)
  if (newStatus !== 'under-review') {
    console.log('📧 ℹ️ [STATUS CHANGE] Status change email only for under-review, skipping:', newStatus);
    console.log('📧 ========== STATUS CHANGE EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  try {
    const statusColor = '#f59e0b'; // amber/warning color for under-review
    const statusText = 'Under Review';

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: complaint.email,
      subject: `🔍 Complaint #${complaint.id} Status Update - Now ${statusText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid ${statusColor};">
            <h2 style="color: #92400e; margin: 0;">🔍 Your Complaint is Being Reviewed</h2>
          </div>
          
          <p>Dear ${complaint.name || 'User'},</p>
          
          <p>Good news! Your complaint has been picked up by our team and is now being reviewed.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Priority:</strong> <span style="text-transform: uppercase;">${complaint.priority}</span></p>
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText.toUpperCase()}</span></p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColor};">
              ${complaint.description}
            </p>
          </div>
          
          <p>Our team is working on resolving your complaint. You will receive another email once it's resolved.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for your patience. If you have any additional information to provide, please submit a new complaint referencing this ID.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [STATUS CHANGE] Email SENT successfully');
    console.log('📧 ✅ [STATUS CHANGE] Recipient:', complaint.email);
    console.log('📧 ✅ [STATUS CHANGE] Message ID:', info.messageId);
    console.log('📧 ========== STATUS CHANGE EMAIL END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [STATUS CHANGE] Email FAILED');
    console.error('📧 ❌ [STATUS CHANGE] Recipient:', complaint.email);
    console.error('📧 ❌ [STATUS CHANGE] Error:', err.message);
    console.log('📧 ========== STATUS CHANGE EMAIL END (FAILED) ==========\n');
    return false;
  }
};

/**
 * Send Test Email - for debugging email configuration
 * @param {string} recipientEmail - Email to send test to
 * @returns {object} - Result with success status and details
 */
const sendTestEmail = async (recipientEmail) => {
  console.log('\n========== TEST EMAIL START ==========');
  console.log('📧 [TEST] Recipient:', recipientEmail);
  console.log('📧 [TEST] RESEND_API_KEY:', RESEND_API_KEY ? 'SET' : 'NOT SET');
  console.log('📧 [TEST] USE_RESEND:', USE_RESEND);
  console.log('📧 [TEST] Resend client exists:', !!resendClient);
  console.log('📧 [TEST] Resend init error:', resendInitError || 'none');
  console.log('📧 [TEST] EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '***' : 'NOT SET');

  const testTo = recipientEmail || process.env.EMAIL_USER || 'test@example.com';
  
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #22c55e;">✅ Email Service Working!</h2>
      <p>This test email was sent from your Complaint Portal.</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
      <p><strong>Method:</strong> ${USE_RESEND && resendClient ? 'Resend API' : 'SMTP'}</p>
      <p><strong>Sent To:</strong> ${testTo}</p>
    </div>
  `;

  const result = await sendEmailUnified({
    to: testTo,
    subject: '✅ Test Email - Complaint Portal (' + new Date().toISOString() + ')',
    html: html
  });

  console.log('📧 [TEST] Result:', result);
  console.log('========== TEST EMAIL END ==========\n');
  
  return {
    ...result,
    recipient: testTo,
    details: {
      RESEND_API_KEY_SET: !!RESEND_API_KEY,
      RESEND_CLIENT_EXISTS: !!resendClient,
      RESEND_INIT_ERROR: resendInitError || null,
      EMAIL_USER_SET: !!process.env.EMAIL_USER,
      EMAIL_PASS_SET: !!process.env.EMAIL_PASS,
    }
  };
};

/**
 * Send Escalation Alert to Superadmin
 * Called when a complaint reaches critical escalation level
 * @param {object} complaint - Complaint object
 * @param {number} hoursOverdue - Hours past SLA
 * @param {string} superadminEmail - Superadmin email from database
 */
const sendSuperadminEscalationAlert = async (complaint, hoursOverdue, superadminEmail) => {
  console.log('\n📧 ========== SUPERADMIN ESCALATION ALERT START ==========');
  console.log('📧 [SUPERADMIN ALERT] Complaint ID:', complaint?.id);
  console.log('📧 [SUPERADMIN ALERT] Escalation Level:', complaint?.escalation_level);
  console.log('📧 [SUPERADMIN ALERT] Superadmin Email:', superadminEmail || 'NONE');

  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [SUPERADMIN ALERT] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.log('📧 ⚠️ [SUPERADMIN ALERT] No transporter - skipping notification');
    console.log('📧 ========== SUPERADMIN ESCALATION ALERT END (SKIPPED) ==========\n');
    return false;
  }

  if (!superadminEmail) {
    console.log('📧 ⚠️ [SUPERADMIN ALERT] No superadmin email provided - skipping notification');
    console.log('📧 ========== SUPERADMIN ESCALATION ALERT END (SKIPPED) ==========\n');
    return false;
  }

  try {
    const urgencyLevel = complaint.escalation_level >= 3 ? 'CRITICAL' : 
                         complaint.escalation_level === 2 ? 'HIGH' : 'MODERATE';
    
    const urgencyColor = complaint.escalation_level >= 3 ? '#dc2626' : 
                         complaint.escalation_level === 2 ? '#f97316' : '#eab308';

    const problemImageSection = complaint.problem_image_url
      ? `<div style="margin: 20px 0;">
           <p><strong>Problem Image:</strong></p>
           <img src="${complaint.problem_image_url}" alt="Problem" style="max-width: 400px; border-radius: 8px; border: 2px solid ${urgencyColor};" />
         </div>`
      : '';

    const userInfo = complaint.is_anonymous || !complaint.email
      ? '<p><strong>Submitted by:</strong> <em>Anonymous User</em></p>'
      : `<p><strong>Submitted by:</strong> ${complaint.name || 'User'} (<a href="mailto:${complaint.email}">${complaint.email}</a>)</p>`;

    const mailOptions = {
      from: `"Complaint Portal - ${urgencyLevel} ALERT" <${process.env.EMAIL_USER}>`,
      to: superadminEmail,
      subject: `🚨 ${urgencyLevel} ESCALATION: Complaint #${complaint.id} - Level ${complaint.escalation_level}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 4px solid ${urgencyColor}; border-radius: 12px;">
          <div style="background-color: ${urgencyColor}15; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h1 style="color: ${urgencyColor}; margin: 0; font-size: 28px;">🚨 ${urgencyLevel} ESCALATION ALERT</h1>
            <p style="color: #666; margin: 10px 0 0 0;">Superadmin Attention Required</p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
            <h3 style="margin-top: 0; color: #1e293b;">Complaint Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Complaint ID:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">#${complaint.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Category:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${complaint.category}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Priority:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="background-color: ${complaint.priority === 'high' ? '#fef2f2' : complaint.priority === 'medium' ? '#fffbeb' : '#f0fdf4'}; 
                               color: ${complaint.priority === 'high' ? '#dc2626' : complaint.priority === 'medium' ? '#d97706' : '#16a34a'}; 
                               padding: 4px 12px; border-radius: 12px; font-weight: bold; text-transform: uppercase;">
                    ${complaint.priority}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Escalation Level:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="background-color: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">
                    Level ${complaint.escalation_level}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Hours Overdue:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: ${urgencyColor}; font-weight: bold;">${hoursOverdue} hours</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Current Status:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${complaint.status}</td>
              </tr>
            </table>
          </div>

          <div style="margin: 20px 0;">
            ${userInfo}
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #1e293b;">Issue Description:</h3>
            <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; border-left: 4px solid #f97316;">
              ${complaint.description}
            </div>
          </div>
          
          ${problemImageSection}
          
          <hr style="margin: 30px 0; border: none; border-top: 2px solid ${urgencyColor};" />
          
          <div style="background-color: ${urgencyColor}15; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="color: ${urgencyColor}; font-weight: bold; font-size: 16px; margin: 0 0 10px 0;">
              ⚠️ IMMEDIATE SUPERADMIN ACTION REQUIRED
            </p>
            <p style="color: #666; margin: 0; font-size: 14px;">
              This complaint has been escalated to Level ${complaint.escalation_level} and exceeds SLA limits by ${hoursOverdue} hours.
              Please review and take appropriate action in the Super Admin Dashboard.
            </p>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
            This is an automated alert from the Complaint Portal Escalation System
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [SUPERADMIN ALERT] Email sent successfully');
    console.log('📧 ✅ [SUPERADMIN ALERT] Recipient:', superadminEmail);
    console.log('📧 ✅ [SUPERADMIN ALERT] Message ID:', info.messageId);
    console.log('📧 ========== SUPERADMIN ESCALATION ALERT END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [SUPERADMIN ALERT] Email FAILED');
    console.error('📧 ❌ [SUPERADMIN ALERT] Error:', err.message);
    console.log('📧 ========== SUPERADMIN ESCALATION ALERT END (FAILED) ==========\n');
    return false;
  }
};

module.exports = {
  initializeTransporter,
  getTransporter,
  getFrontendUrl,
  getAdminEmail,
  sendComplaintSubmissionEmail,
  sendEscalationEmail,
  sendResolutionEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendStatusChangeEmail,
  sendTestEmail,
  sendSuperadminEscalationAlert,
};
