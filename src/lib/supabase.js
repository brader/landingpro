import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://uzrbxozweucrntreqvib.supabase.co";
const fallbackSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6cmJ4b3p3ZXVjcm50cmVxdmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTQ1OTgsImV4cCI6MjA5MjE5MDU5OH0.3j3zDlykJV5NEB48guM3IDLokRUNLXq3aOblk_I3YUc";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const publicDomain = import.meta.env.VITE_PUBLIC_LP_DOMAIN || "lp.novamos.id";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

export async function sendPasswordReset(email) {
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function ensureUserWorkspace(user) {
  if (!supabase || !user) return null;
  const email = normalizeEmail(user.email);

  const { data: existing, error: selectError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: membership, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  if (membership?.workspace_id) {
    const { data: memberWorkspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", membership.workspace_id)
      .single();

    if (workspaceError) throw workspaceError;
    if (memberWorkspace) return memberWorkspace;
  }

  if (email) {
    const { data: invite, error: inviteError } = await supabase
      .from("workspace_invites")
      .select("id,workspace_id,role,email,created_at")
      .eq("email", email)
      .is("accepted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (inviteError) throw inviteError;

    if (invite?.workspace_id) {
      const { error: insertMemberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: invite.workspace_id,
          user_id: user.id,
          email,
          role: invite.role || "member"
        });

      if (insertMemberError) throw insertMemberError;

      const { error: acceptInviteError } = await supabase
        .from("workspace_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      if (acceptInviteError) throw acceptInviteError;

      const { data: invitedWorkspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", invite.workspace_id)
        .single();

      if (workspaceError) throw workspaceError;
      if (invitedWorkspace) return invitedWorkspace;
    }
  }

  const { data: workspace, error: insertError } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: "Novamos Landing Pages"
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return workspace;
}

export async function loadWorkspacePages(workspace) {
  if (!supabase || !workspace) return [];

  const { data, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("workspace_uuid", workspace.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row.payload,
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedUrl: row.published_url,
    storagePath: row.storage_path
  }));
}

export async function loadWorkspaceMembers(workspace) {
  if (!supabase || !workspace) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,user_id,email,role,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function loadWorkspaceInvites(workspace) {
  if (!supabase || !workspace) return [];

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id,workspace_id,email,role,accepted_at,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function inviteWorkspaceMember(workspace, email, role = "member", invitedBy = null) {
  const normalizedEmail = normalizeEmail(email);
  if (!supabase || !workspace || !normalizedEmail) return null;

  const { data, error } = await supabase
    .from("workspace_invites")
    .upsert({
      workspace_id: workspace.id,
      email: normalizedEmail,
      role,
      invited_by: invitedBy,
      accepted_at: null
    }, {
      onConflict: "workspace_id,email"
    })
    .select("id,workspace_id,email,role,accepted_at,created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function addWorkspaceMember(workspace, userId, role = "member") {
  if (!supabase || !workspace || !userId) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role
    })
    .select("workspace_id,user_id,email,role,created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function removeWorkspaceInvite(workspace, inviteId) {
  if (!supabase || !workspace || !inviteId) return;

  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("id", inviteId);

  if (error) throw error;
}

export async function removeWorkspaceMember(workspace, userId) {
  if (!supabase || !workspace || !userId) return;

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function saveLandingPage(page, domain, workspace, user) {
  if (!supabase || !workspace || !user) return null;

  const payload = {
    ...page,
    updatedAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("landing_pages")
    .upsert({
      id: page.id,
      owner_id: user.id,
      workspace_uuid: workspace.id,
      workspace_id: workspace.id,
      name: page.name,
      slug: page.slug,
      status: page.status,
      template: page.template,
      seo_title: page.seoTitle || page.name,
      seo_description: page.seoDescription || "",
      published_url: page.publishedUrl || `https://${domain}/${page.slug}/`,
      storage_path: page.storagePath || null,
      payload
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveAllLandingPages(pages, domain, workspace, user) {
  for (const page of pages) {
    await saveLandingPage(page, domain, workspace, user);
  }
}

export async function publishStaticPage(page, html, domain, workspace, user) {
  if (!supabase || !workspace || !user) return null;

  const safeSlug = page.slug || page.id;
  const storagePath = `${user.id}/${safeSlug}/index.html`;
  const { error: uploadError } = await supabase.storage
    .from("landing-pages")
    .upload(storagePath, new Blob([html], { type: "text/html;charset=utf-8" }), {
      cacheControl: "300",
      contentType: "text/html;charset=utf-8",
      upsert: true
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from("landing-pages")
    .getPublicUrl(storagePath);

  const publishedPage = {
    ...page,
    status: "Published",
    publishedUrl: `https://${domain}/${safeSlug}/`,
    storagePath,
    storagePublicUrl: publicData.publicUrl
  };

  await saveLandingPage(publishedPage, domain, workspace, user);
  return publishedPage;
}
