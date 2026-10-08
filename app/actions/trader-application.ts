"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitTraderApplication(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/profile/trader-application?error=setup");
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in?notice=join");

  const contactName = text(formData, "contact_name");
  const contactEmail = auth.user.email?.trim().toLowerCase() ?? "";
  const contactPhone = text(formData, "contact_phone");
  const preferredTimezone = text(formData, "preferred_timezone") || "Africa/Kampala";
  const interviewAvailability = text(formData, "interview_availability");
  const publicName = text(formData, "public_name");
  const markets = [...new Set(text(formData, "markets").split(",").map((market) => market.trim().toUpperCase()).filter(Boolean))];
  const yearsExperience = Number(text(formData, "years_experience"));
  const experience = text(formData, "experience_summary");
  const approach = text(formData, "trading_approach");
  const assessment = text(formData, "assessment_response");
  const codeAccepted = formData.get("code_accepted") === "on";
  let validTimezone = true;
  try { new Intl.DateTimeFormat("en", { timeZone: preferredTimezone }); }
  catch { validTimezone = false; }
  if (
    contactName.length < 2 || contactName.length > 120 || !contactEmail ||
    !/^[+()0-9 .-]{7,32}$/.test(contactPhone) || (contactPhone.match(/\d/g)?.length ?? 0) < 7 ||
    !validTimezone ||
    interviewAvailability.length > 500
  ) redirect("/profile/trader-application?error=contact");

  if (
    publicName.length < 2 || publicName.length > 80 ||
    markets.length === 0 || markets.length > 12 || markets.some((market) => market.length > 20 || !/^[A-Z0-9 ./_-]+$/.test(market)) ||
    !Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60 ||
    experience.length < 40 || experience.length > 1600 ||
    approach.length < 80 || approach.length > 2400 ||
    assessment.length < 120 || assessment.length > 3200 ||
    !codeAccepted
  ) {
    redirect("/profile/trader-application?error=details");
  }

  const [{ data: foundingTrader, error: foundingError }, { data: financialTrader, error: traderError }] = await Promise.all([
    supabase.rpc("request_has_staff_role", { required_role: "founding_trader" }),
    supabase.rpc("request_has_staff_role", { required_role: "financial_trader" }),
  ]);
  if (foundingError || traderError) redirect("/profile/trader-application?error=setup");
  if (foundingTrader || financialTrader) redirect("/profile/trader-application?error=already");

  const { error } = await supabase.from("trader_applications").insert({
    member_id: auth.user.id,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    preferred_timezone: preferredTimezone,
    interview_availability: interviewAvailability,
    public_name: publicName,
    markets,
    years_experience: yearsExperience,
    experience_summary: experience,
    trading_approach: approach,
    assessment_response: assessment,
    code_accepted: true,
  });

  if (error) {
    if (error.code === "23505") redirect("/profile/trader-application?error=duplicate");
    if (error.code === "42P01" || error.code === "PGRST205") redirect("/profile/trader-application?error=setup");
    redirect("/profile/trader-application?error=save");
  }

  revalidatePath("/profile");
  revalidatePath("/profile/trader-application");
  redirect("/profile/trader-application?submitted=1");
}

export async function scheduleTraderInterview(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/admin?error=setup");
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in");
  const { data: isAdmin, error: adminError } = await supabase.rpc("request_is_admin");
  if (adminError || isAdmin !== true) redirect("/admin?error=forbidden");

  const applicationId = text(formData, "application_id");
  const localAppointment = text(formData, "interview_at");
  const zoomUrl = text(formData, "zoom_url");
  const publicMessage = text(formData, "public_message");
  const appointment = new Date(`${localAppointment}:00+03:00`);
  const submittedLocalTime = Number.isNaN(appointment.getTime())
    ? ""
    : new Date(appointment.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
  let validZoom = false;
  try {
    const url = new URL(zoomUrl);
    validZoom = url.protocol === "https:" && (url.hostname === "zoom.us" || url.hostname.endsWith(".zoom.us"));
  } catch { validZoom = false; }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localAppointment) ||
    submittedLocalTime !== localAppointment ||
    Number.isNaN(appointment.getTime()) || appointment.getTime() <= Date.now() ||
    !validZoom || zoomUrl.length > 500 || publicMessage.length > 1200
  ) redirect("/admin?error=interview");

  const { error } = await supabase.rpc("schedule_trader_interview", {
    p_application_id: applicationId,
    p_interview_at: appointment.toISOString(),
    p_zoom_url: zoomUrl,
    p_public_message: publicMessage || "The DRACARYS Administration Department has arranged your Zoom interview. Review the appointment details in your application.",
  });
  if (error) redirect("/admin?error=interview");
  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/profile/trader-application");
  redirect("/admin?interview=scheduled");
}

export async function sendTraderApplicationResponse(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/profile/trader-application?error=setup");
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in?notice=join");
  const applicationId = text(formData, "application_id");
  const response = text(formData, "response");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId) || response.length < 20 || response.length > 1800) {
    redirect("/profile/trader-application?error=details");
  }

  const { error } = await supabase.from("trader_application_responses").insert({
    application_id: applicationId,
    member_id: auth.user.id,
    response,
  });
  if (error) redirect(error.code === "42P01" || error.code === "PGRST205" ? "/profile/trader-application?error=setup" : "/profile/trader-application?error=response");
  revalidatePath("/admin");
  revalidatePath("/profile/trader-application");
  redirect("/profile/trader-application?responded=1");
}

export async function reviewTraderApplication(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/admin?error=setup");
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/sign-in");

  const { data: isAdmin, error: adminError } = await supabase.rpc("request_is_admin");
  if (adminError || isAdmin !== true) redirect("/admin?error=forbidden");

  const applicationId = text(formData, "application_id");
  const status = text(formData, "status");
  const allowedStatuses = new Set(["reviewing", "verification", "assessment", "interview_scheduled", "interview_completed", "needs_information", "approved", "declined"]);
  const scoreText = text(formData, "assessment_score");
  const score = scoreText ? Number(scoreText) : null;
  const publicMessage = text(formData, "public_message");
  const privateNotes = text(formData, "private_notes");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId) || !allowedStatuses.has(status) ||
    (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) ||
    publicMessage.length > 1200 || privateNotes.length > 4000
  ) redirect("/admin?error=details");

  const { error } = await supabase.rpc("review_trader_application", {
    p_application_id: applicationId,
    p_new_status: status,
    p_identity_verified: formData.get("identity_verified") === "on",
    p_background_verified: formData.get("background_verified") === "on",
    p_assessment_passed: formData.get("assessment_passed") === "on",
    p_assessment_score: score,
    p_public_message: publicMessage,
    p_private_notes: privateNotes,
  });

  if (error) redirect("/admin?error=review");
  revalidatePath("/admin");
  revalidatePath("/traders");
  revalidatePath("/profile");
  revalidatePath("/profile/trader-application");
  redirect("/admin?reviewed=1");
}
