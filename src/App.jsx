import { useEffect, useMemo, useRef, useState } from "react";
import {
  ensureUserWorkspace,
  getCurrentSession,
  inviteWorkspaceMember,
  isSupabaseConfigured,
  loadWorkspaceInvites,
  loadWorkspaceMembers,
  loadWorkspacePages,
  onAuthChange,
  publicDomain,
  purgePublishedPage,
  publishImageAsset,
  publishStaticPage,
  removeWorkspaceInvite,
  removeWorkspaceMember,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword
} from "./lib/supabase.js";

const storeKey = "landingpro-react-state-v1";

const blockCatalog = [
  { type: "header", label: "Header", hint: "Judul dan subjudul" },
  { type: "image", label: "Image", hint: "Gambar responsive" },
  { type: "text", label: "Teks", hint: "Paragraf biasa" },
  { type: "bulletList", label: "List Bullet", hint: "Bullet dengan icon" },
  { type: "divider", label: "Divider", hint: "Garis spasi" },
  { type: "button", label: "Tombol", hint: "Button dengan icon" },
  { type: "whatsappButton", label: "WhatsApp", hint: "CTA chat WA" },
  { type: "htmlCode", label: "HTML Code", hint: "Custom embed/code" }
];

const templates = [
  { id: "lead-gen", name: "Lead Generation", category: "Jasa / konsultasi", goal: "Kumpulkan prospek dari Meta Ads", sections: ["header", "image", "text", "bulletList", "button", "divider", "whatsappButton"] },
  { id: "physical-product", name: "Produk Fisik", category: "Ecommerce", goal: "Dorong klik WhatsApp atau checkout", sections: ["header", "image", "bulletList", "divider", "button", "whatsappButton"] },
  { id: "digital-product", name: "Produk Digital", category: "Course / ebook", goal: "Jelaskan value dan konversi cepat", sections: ["header", "text", "bulletList", "button", "divider", "htmlCode"] },
  { id: "advertorial", name: "Advertorial Ringan", category: "Story selling", goal: "Buat narasi pendek yang tetap cepat", sections: ["header", "text", "image", "bulletList", "button"] },
  { id: "catalog", name: "Katalog Singkat", category: "Multiple SKU", goal: "Tampilkan pilihan produk tanpa toko berat", sections: ["header", "image", "text", "divider", "whatsappButton"] },
  { id: "whatsapp", name: "WhatsApp Conversion", category: "Chat first", goal: "Maksimalkan klik chat dari mobile", sections: ["header", "bulletList", "button", "whatsappButton"] }
];

const sectionDefaults = {
  header: { title: "Headline landing page Anda", body: "Subheadline singkat yang menjelaskan value utama offer.", level: "h1" },
  image: { src: "", image: "Gambar produk atau offer", caption: "Preview image", body: "Gunakan gambar WebP/AVIF yang sudah dikompresi.", imageSize: 100, optimizedInfo: "" },
  text: { body: "Tulis paragraf pendek yang mudah discan oleh traffic mobile dari iklan Meta." },
  bulletList: { title: "Benefit utama", items: "Cepat dipahami|Mobile-first|CTA jelas", icon: "✓" },
  divider: { body: "", thickness: 1, dividerStyle: "solid" },
  button: { cta: "Klik Sekarang", link: "#offer", icon: "→", sticky: false },
  whatsappButton: { cta: "Chat WhatsApp", phone: "6281234567890", message: "Halo, saya tertarik dengan promo ini.", icon: "☎", sticky: false },
  htmlCode: { body: "<div style=\"padding:12px;border:1px solid #ddd;border-radius:8px\">Custom HTML</div>" }
};

const styleDefaults = {
  background: "#ffffff",
  textColor: "#17202a",
  accentColor: "#0f9f7a",
  align: "left",
  padding: 28,
  radius: 8,
  hidden: false
};

const navItems = [
  ["dashboard", "D", "Dashboard"],
  ["pages", "P", "Pages"],
  ["templates", "T", "Templates"],
  ["editor", "E", "Editor"],
  ["analytics", "A", "Analytics"],
  ["settings", "S", "Settings"],
  ["blueprint", "B", "Blueprint"]
];

function defaultStyleForType(type) {
  return {
    ...styleDefaults,
    ...(type === "header" ? { background: "#17202a", textColor: "#ffffff", padding: 36 } : {}),
    ...(type === "divider" ? { padding: 18 } : {}),
    ...(type === "button" || type === "whatsappButton" ? { align: "center", padding: 20 } : {})
  };
}

function createSections(types) {
  return types.map((type, index) => ({
    id: `${type}-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 6)}`,
    type,
    style: defaultStyleForType(type),
    ...sectionDefaults[type]
  }));
}

function initialState() {
  const inviteEmail = getInviteEmailFromUrl();
  return {
    activeView: "dashboard",
    previewMode: "mobile",
    sidebarCollapsed: false,
    builderPanel: "widgets",
    inspectorTab: "content",
    selectedSectionId: null,
    draggedSectionId: null,
    dropTargetId: null,
    dropPosition: null,
    pixelId: "1234567890",
    domain: publicDomain,
    dbStatus: isSupabaseConfigured ? "Supabase ready" : "Local only",
    authMode: inviteEmail ? "register" : "login",
    authBusy: false,
    authEmail: inviteEmail,
    authPassword: "",
    resetEmail: inviteEmail,
    newPassword: "",
    confirmPassword: "",
    inviteEmail: "",
    memberRole: "member",
    members: [],
    invites: [],
    session: null,
    workspace: null,
    toast: "",
    pages: [
      {
        id: "lp-001",
        name: "Promo WhatsApp April",
        slug: "promo-whatsapp-april",
        status: "Draft",
        template: "WhatsApp Conversion",
        views: 3280,
        ctr: 18.4,
        leads: 192,
        seoTitle: "Promo WhatsApp April",
        seoDescription: "Landing page cepat untuk campaign Meta Ads.",
        sections: createSections(["header", "image", "text", "bulletList", "button", "whatsappButton"])
      }
    ],
    activePageId: "lp-001"
  };
}

function normalizeState(nextState) {
  const fallback = initialState();
  const inviteEmail = getInviteEmailFromUrl();
  const pages = Array.isArray(nextState.pages) && nextState.pages.length ? nextState.pages : fallback.pages;
  const normalizedDomain = normalizePublishDomain(nextState.domain);
  return {
    ...nextState,
    activePageId: pages.some((page) => page.id === nextState.activePageId) ? nextState.activePageId : pages[0].id,
    toast: "",
    dbStatus: isSupabaseConfigured ? nextState.dbStatus || "Supabase ready" : "Local only",
    domain: normalizedDomain,
    session: nextState.session || null,
    workspace: nextState.workspace || null,
    authMode: inviteEmail ? "register" : nextState.authMode || "login",
    authBusy: false,
    authEmail: inviteEmail || nextState.authEmail || "",
    resetEmail: nextState.resetEmail || "",
    newPassword: "",
    confirmPassword: "",
    inviteEmail: nextState.inviteEmail || "",
    memberRole: nextState.memberRole || "member",
    members: Array.isArray(nextState.members) ? nextState.members : [],
    invites: Array.isArray(nextState.invites) ? nextState.invites : [],
    draggedSectionId: null,
    dropTargetId: null,
    dropPosition: null,
    pages: pages.map((page) => ({
      ...page,
      seoTitle: page.seoTitle || page.name,
      seoDescription: page.seoDescription || "Landing page cepat untuk campaign Meta Ads.",
      sections: (Array.isArray(page.sections) && page.sections.length ? page.sections : createSections(["header", "text", "button"])).map(normalizeSection)
    }))
  };
}

function normalizeSection(section) {
  const migrated = migrateLegacySection(section);
  return {
    ...sectionDefaults[migrated.type],
    ...migrated,
    style: { ...defaultStyleForType(migrated.type), ...(migrated.style || {}) }
  };
}

function migrateLegacySection(section) {
  if (sectionDefaults[section.type]) return { ...section };
  if (["hero", "offer", "countdown"].includes(section.type)) {
    return {
      ...section,
      type: "header",
      title: section.title || "Headline landing page Anda",
      body: section.body || "",
      level: "h1"
    };
  }
  if (["benefits", "highlights", "faq", "testimonials"].includes(section.type)) {
    return {
      ...section,
      type: "bulletList",
      title: section.title || "Benefit utama",
      items: section.items || section.body || "Benefit pertama|Benefit kedua",
      icon: "✓"
    };
  }
  if (section.type === "cta") {
    return {
      ...section,
      type: "button",
      cta: section.cta || "Klik Sekarang",
      link: "#offer",
      icon: "→"
    };
  }
  if (section.type === "leadForm") {
    return {
      ...section,
      type: "htmlCode",
      body: "<form><input placeholder=\"Nama\"><input placeholder=\"WhatsApp\"><button>Kirim</button></form>"
    };
  }
  return {
    ...section,
    type: "text",
    body: section.body || section.title || "Tulis teks landing page Anda."
  };
}

function loadState() {
  const saved = safeStorageGet(storeKey);
  if (!saved) return initialState();
  try {
    return normalizeState({ ...initialState(), ...JSON.parse(saved) });
  } catch {
    return initialState();
  }
}

export default function App() {
  const [state, setState] = useState(loadState);
  const page = useMemo(() => state.pages.find((item) => item.id === state.activePageId) || state.pages[0], [state.pages, state.activePageId]);
  const selected = page.sections.find((section) => section.id === state.selectedSectionId) || page.sections[0];
  const activePublishDomain = normalizePublishDomain(state.domain);
  const activeVisitUrl = page?.slug ? `https://${activePublishDomain}/${page.slug}/` : page?.publishedUrl;

  useEffect(() => {
    const persistable = { ...state, toast: "", draggedSectionId: null, dropTargetId: null, dropPosition: null, session: null, workspace: null, newPassword: "", confirmPassword: "", members: [], invites: [] };
    safeStorageSet(storeKey, JSON.stringify(persistable));
  }, [state]);

  useEffect(() => {
    if (!state.toast) return undefined;
    const timer = window.setTimeout(() => setState((current) => ({ ...current, toast: "" })), 2400);
    return () => window.clearTimeout(timer);
  }, [state.toast]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;

    async function bootstrapAuth() {
      setState((current) => ({ ...current, dbStatus: "Loading Supabase..." }));
      try {
        const session = await getCurrentSession();
        if (cancelled) return;
        if (!session) {
          setState((current) => ({ ...current, dbStatus: "Auth required", session: null, workspace: null }));
          return;
        }
        await loadAuthenticatedWorkspace(session);
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({ ...current, dbStatus: "Supabase error", toast: error.message }));
        }
      }
    }

    bootstrapAuth();
    const unsubscribe = onAuthChange((session) => {
      if (session) {
        loadAuthenticatedWorkspace(session);
      } else {
        setState((current) => ({ ...current, session: null, workspace: null, dbStatus: "Auth required" }));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function loadAuthenticatedWorkspace(session) {
    const workspace = await ensureUserWorkspace(session.user);
    const dbPages = await loadWorkspacePages(workspace);
    const members = await loadWorkspaceMembers(workspace);
    const invites = await loadWorkspaceInvites(workspace);
    setState((current) => normalizeState({
      ...current,
      session,
      workspace,
      members,
      invites,
      pages: dbPages.length ? dbPages : current.pages,
      activePageId: dbPages.length ? dbPages[0].id : current.activePageId,
      selectedSectionId: dbPages.length ? dbPages[0].sections?.[0]?.id || null : current.selectedSectionId,
      dbStatus: dbPages.length ? "Synced with Supabase" : "Supabase empty",
      toast: dbPages.length ? "Data dimuat dari Supabase." : "Workspace Supabase siap."
    }));
  }

  function patch(mutator, toast) {
    setState((current) => {
      const draft = cloneData(current);
      mutator(draft);
      if (toast) draft.toast = toast;
      return draft;
    });
  }

  function setView(activeView) {
    patch((draft) => {
      draft.activeView = activeView;
    });
  }

  function addPage(template = templates[0]) {
    patch((draft) => {
      const nextPage = newPageFromTemplate(template);
      draft.pages.unshift(nextPage);
      draft.activePageId = nextPage.id;
      draft.selectedSectionId = nextPage.sections[0].id;
      draft.activeView = "editor";
    }, "Landing page baru dibuat.");
  }

  function updateActivePage(field, value) {
    patch((draft) => {
      const target = getActivePage(draft);
      target[field] = value;
    });
  }

  function updateSelectedSection(field, value) {
    patch((draft) => {
      getSelectedSection(draft)[field] = value;
    });
  }

  function updateSelectedStyle(field, value) {
    patch((draft) => {
      getSelectedSection(draft).style[field] = value;
    });
  }

  function duplicatePage(id = page.id) {
    patch((draft) => {
      const source = draft.pages.find((item) => item.id === id) || getActivePage(draft);
      const clone = clonePage(source);
      draft.pages.unshift(clone);
      draft.activePageId = clone.id;
      draft.selectedSectionId = clone.sections[0]?.id || null;
      draft.activeView = "editor";
    }, "Page berhasil diduplikasi.");
  }

  function addSection(type, droppedId = null, position = "after") {
    patch((draft) => {
      const target = getActivePage(draft);
      const [newSection] = createSections([type]);
      if (droppedId) {
        const targetIndex = target.sections.findIndex((section) => section.id === droppedId);
        const insertAt = targetIndex >= 0 && position === "before" ? targetIndex : targetIndex + 1;
        target.sections.splice(Math.max(0, insertAt), 0, newSection);
      } else {
        target.sections.push(newSection);
      }
      draft.selectedSectionId = newSection.id;
      draft.builderPanel = "navigator";
      draft.dropTargetId = null;
      draft.dropPosition = null;
    });
  }

  function cloneSection(id) {
    patch((draft) => {
      const target = getActivePage(draft);
      const index = target.sections.findIndex((section) => section.id === id);
      if (index >= 0) {
        const clone = cloneData(target.sections[index]);
        clone.id = `${clone.type}-${Date.now()}`;
        target.sections.splice(index + 1, 0, clone);
        draft.selectedSectionId = clone.id;
      }
    }, "Section berhasil di-clone.");
  }

  function deleteSection(id) {
    patch((draft) => {
      const target = getActivePage(draft);
      target.sections = target.sections.filter((section) => section.id !== id);
      draft.selectedSectionId = target.sections[0]?.id || null;
    });
  }

  function moveSection(id, dir) {
    patch((draft) => {
      const target = getActivePage(draft);
      const index = target.sections.findIndex((section) => section.id === id);
      const next = index + dir;
      if (index >= 0 && next >= 0 && next < target.sections.length) {
        [target.sections[index], target.sections[next]] = [target.sections[next], target.sections[index]];
      }
    });
  }

  function reorderSection(draggedId, droppedId, position = "before") {
    if (!draggedId || draggedId === droppedId) return;
    patch((draft) => {
      const target = getActivePage(draft);
      const from = target.sections.findIndex((section) => section.id === draggedId);
      const to = target.sections.findIndex((section) => section.id === droppedId);
      if (from < 0 || to < 0) return;
      const [moved] = target.sections.splice(from, 1);
      const targetIndexAfterRemoval = target.sections.findIndex((section) => section.id === droppedId);
      const insertAt = position === "after" ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
      target.sections.splice(insertAt, 0, moved);
      draft.selectedSectionId = moved.id;
      draft.draggedSectionId = null;
      draft.dropTargetId = null;
      draft.dropPosition = null;
    }, "Urutan section diperbarui.");
  }

  function toggleHidden(id) {
    patch((draft) => {
      const section = getActivePage(draft).sections.find((item) => item.id === id);
      if (section) {
        section.style.hidden = !section.style.hidden;
        draft.selectedSectionId = section.id;
      }
    });
  }

  async function publishPage() {
    const publishDomain = state.domain || publicDomain;
    const publishedDraft = { ...page, status: "Published", publishedUrl: `https://${publishDomain}/${page.slug}/` };

    if (!isSupabaseConfigured) {
      patch((draft) => {
        getActivePage(draft).status = "Published";
        getActivePage(draft).publishedUrl = publishedDraft.publishedUrl;
      }, `Published lokal: ${publishedDraft.publishedUrl}`);
      return;
    }

    if (!state.session || !state.workspace) {
      setState((current) => ({ ...current, dbStatus: "Auth required", toast: "Login dulu untuk publish dan menyimpan ke Supabase." }));
      return;
    }

    setState((current) => ({ ...current, dbStatus: "Publishing..." }));
    try {
      const optimizedDraft = await externalizePublishedImages(publishedDraft);
      const html = buildStaticHtml(optimizedDraft, publishDomain, state.pixelId);
      const publishedPage = await publishStaticPage(optimizedDraft, html, publishDomain, state.workspace, state.session.user);
      setState((current) => {
        const draft = cloneData(current);
        const target = getActivePage(draft);
        Object.assign(target, {
          sections: publishedPage.sections,
          status: "Published",
          publishedUrl: publishedPage.publishedUrl,
          storagePath: publishedPage.storagePath,
          storagePublicUrl: publishedPage.storagePublicUrl
        });
        draft.dbStatus = "Saved and published";
        draft.toast = publishedPage.edgePublished
          ? `Published ke Cloudflare KV: ${publishedPage.publishedUrl}`
          : publishedPage.cachePurged
            ? `Published, saved, cache purged: ${publishedPage.publishedUrl}`
            : `Published & saved: ${publishedPage.publishedUrl}`;
        return draft;
      });
    } catch (error) {
      setState((current) => ({ ...current, dbStatus: "Supabase error", toast: error.message }));
    }
  }

  async function externalizePublishedImages(sourcePage) {
    const nextPage = cloneData(sourcePage);
    const imageSections = nextPage.sections.filter((section) => section.type === "image" && String(section.src || "").startsWith("data:image/"));
    if (!imageSections.length) return nextPage;

    setState((current) => ({ ...current, dbStatus: "Optimizing images..." }));
    for (const section of imageSections) {
      const imageUrl = await publishImageAsset(nextPage.slug || nextPage.id, section.id, section.src);
      section.src = imageUrl;
      section.optimizedInfo = "Image published as external optimized asset for faster first load.";
    }
    return nextPage;
  }

  async function purgeActivePageCache() {
    if (!page?.slug) return;
    setState((current) => ({ ...current, dbStatus: "Purging cache..." }));
    const purged = await purgePublishedPage(state.domain || publicDomain, page.slug);
    setState((current) => ({
      ...current,
      dbStatus: purged ? "Cache purged" : "Purge unavailable",
      toast: purged ? "Cache halaman berhasil dibersihkan." : "Purge cache belum berhasil. Coba publish ulang."
    }));
  }

  function exportPage() {
    const html = buildStaticHtml(page, state.domain || publicDomain, state.pixelId);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${page.slug || "landing-page"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setState((current) => ({ ...current, toast: "Static HTML berhasil diexport." }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!isSupabaseConfigured || state.authBusy) return;

    if (state.authMode === "forgot") {
      const email = state.resetEmail || state.authEmail;
      if (!email) {
        setState((current) => ({ ...current, toast: "Isi email untuk menerima link reset password." }));
        return;
      }
      setState((current) => ({ ...current, authBusy: true, dbStatus: "Sending reset link..." }));
      try {
        await sendPasswordReset(email);
        setState((current) => ({ ...current, authBusy: false, dbStatus: "Reset email sent", toast: "Link reset password sudah dikirim ke email." }));
      } catch (error) {
        setState((current) => ({ ...current, authBusy: false, dbStatus: "Auth error", toast: error.message }));
      }
      return;
    }

    setState((current) => ({ ...current, authBusy: true, dbStatus: "Authenticating..." }));
    try {
      const session = state.authMode === "login"
        ? await signIn(state.authEmail, state.authPassword)
        : await signUp(state.authEmail, state.authPassword);
      if (session) {
        await loadAuthenticatedWorkspace(session);
      } else {
        setState((current) => ({ ...current, authBusy: false, authMode: "registered", dbStatus: "Check email", toast: "Cek email untuk konfirmasi akun Supabase." }));
      }
    } catch (error) {
      setState((current) => ({ ...current, authBusy: false, dbStatus: "Auth error", toast: error.message }));
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setState((current) => ({ ...current, session: null, workspace: null, dbStatus: "Auth required", toast: "Berhasil logout." }));
    } catch (error) {
      setState((current) => ({ ...current, toast: error.message }));
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    if (state.newPassword.length < 6) {
      setState((current) => ({ ...current, toast: "Password minimal 6 karakter." }));
      return;
    }
    if (state.newPassword !== state.confirmPassword) {
      setState((current) => ({ ...current, toast: "Konfirmasi password belum sama." }));
      return;
    }

    setState((current) => ({ ...current, dbStatus: "Updating password..." }));
    try {
      await updatePassword(state.newPassword);
      setState((current) => ({ ...current, newPassword: "", confirmPassword: "", dbStatus: "Password updated", toast: "Password berhasil diganti." }));
    } catch (error) {
      setState((current) => ({ ...current, dbStatus: "Auth error", toast: error.message }));
    }
  }

  async function handleSendResetPassword(event) {
    event.preventDefault();
    const email = state.resetEmail || state.session?.user?.email;
    if (!email) {
      setState((current) => ({ ...current, toast: "Isi email untuk menerima link reset password." }));
      return;
    }
    setState((current) => ({ ...current, dbStatus: "Sending reset link..." }));
    try {
      await sendPasswordReset(email);
      setState((current) => ({ ...current, dbStatus: "Reset email sent", toast: "Link reset password sudah dikirim." }));
    } catch (error) {
      setState((current) => ({ ...current, dbStatus: "Auth error", toast: error.message }));
    }
  }

  async function refreshUsers(workspace = state.workspace) {
    if (!workspace) return;
    const [members, invites] = await Promise.all([
      loadWorkspaceMembers(workspace),
      loadWorkspaceInvites(workspace)
    ]);
    setState((current) => ({ ...current, members, invites }));
  }

  async function handleInviteMember(event) {
    event.preventDefault();
    if (!state.workspace || !state.inviteEmail) {
      setState((current) => ({ ...current, toast: "Isi email member." }));
      return;
    }
    setState((current) => ({ ...current, dbStatus: "Inviting member..." }));
    try {
      await inviteWorkspaceMember(state.workspace, state.inviteEmail, state.memberRole, state.session?.user?.id || null);
      await refreshUsers();
      setState((current) => ({ ...current, inviteEmail: "", dbStatus: "Invite added", toast: "Invite email berhasil ditambahkan." }));
    } catch (error) {
      setState((current) => ({ ...current, dbStatus: "Member error", toast: error.message }));
    }
  }

  async function handleRemoveMember(userId) {
    if (!state.workspace || userId === state.session?.user?.id) return;
    setState((current) => ({ ...current, dbStatus: "Removing member..." }));
    try {
      await removeWorkspaceMember(state.workspace, userId);
      await refreshUsers();
      setState((current) => ({ ...current, dbStatus: "Member removed", toast: "Member berhasil dihapus." }));
    } catch (error) {
      setState((current) => ({ ...current, dbStatus: "Member error", toast: error.message }));
    }
  }

  async function handleRemoveInvite(inviteId) {
    if (!state.workspace || !inviteId) return;
    setState((current) => ({ ...current, dbStatus: "Removing invite..." }));
    try {
      await removeWorkspaceInvite(state.workspace, inviteId);
      await refreshUsers();
      setState((current) => ({ ...current, dbStatus: "Invite removed", toast: "Invite berhasil dihapus." }));
    } catch (error) {
      setState((current) => ({ ...current, dbStatus: "Member error", toast: error.message }));
    }
  }

  const viewTitle = {
    dashboard: "Dashboard",
    pages: "Landing Pages",
    templates: "Template Gallery",
    editor: "Editor",
    analytics: "Analytics",
    settings: "Domain & Settings",
    blueprint: "Product Blueprint"
  }[state.activeView];

  if (isSupabaseConfigured && !state.session) {
    return (
      <>
        <AuthScreen state={state} setState={setState} onSubmit={handleAuthSubmit} />
        <div className={`toast ${state.toast ? "is-visible" : ""}`} role="status" aria-live="polite">{state.toast}</div>
      </>
    );
  }

  return (
    <div className={`app-shell ${state.sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Navigasi utama">
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark">LP</span>
            <div className="brand-copy">
              <strong>LandingPro</strong>
              <small>Meta Ads Builder</small>
            </div>
          </div>
          <button
            className="collapse-btn"
            onClick={() => patch((draft) => { draft.sidebarCollapsed = !draft.sidebarCollapsed; })}
            title={state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {state.sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>
        <nav className="nav">
          {navItems.map(([view, icon, label]) => (
            <button key={view} className={`nav-item ${state.activeView === view ? "is-active" : ""}`} onClick={() => setView(view)} title={label}>
              <span className="icon">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <strong>Fast by design</strong>
          <span>Output HTML ringan, gambar dikompresi, script pihak ketiga dibatasi.</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{viewTitle}</h1>
          </div>
          <div className="top-actions">
            {state.activeView === "editor" && (
              <>
                <span className={`db-status ${isSupabaseConfigured ? "is-online" : ""}`}>{state.dbStatus}</span>
                <button className="ghost-btn" onClick={() => duplicatePage()} title="Duplicate page">Copy</button>
                {page.status === "Published" && activeVisitUrl && (
                  <a className="ghost-btn" href={activeVisitUrl} target="_blank" rel="noreferrer" title="Open published page">Visit Page</a>
                )}
                {page.status === "Published" && (
                  <button className="ghost-btn" onClick={purgeActivePageCache} title="Clear cached published page">Purge Cache</button>
                )}
                <button className="ghost-btn" onClick={exportPage} title="Export static HTML">Export HTML</button>
                <button className="primary-btn" onClick={publishPage} title="Save to database and publish static HTML">Publish</button>
              </>
            )}
            {state.session && <button className="ghost-btn" onClick={handleSignOut} title="Sign out">Logout</button>}
          </div>
        </header>

        {state.activeView === "dashboard" && <Dashboard page={page} domain={state.domain || publicDomain} setView={setView} addPage={addPage} />}
        {state.activeView === "pages" && <Pages pages={state.pages} domain={state.domain || publicDomain} editPage={(id) => patch((draft) => { draft.activePageId = id; draft.selectedSectionId = getActivePage(draft).sections[0]?.id || null; draft.activeView = "editor"; })} duplicatePage={duplicatePage} addPage={addPage} />}
        {state.activeView === "templates" && <Templates addPage={addPage} />}
        {state.activeView === "editor" && (
          <Editor
            state={state}
            page={page}
            selected={selected}
            setState={setState}
            patch={patch}
            addSection={addSection}
            cloneSection={cloneSection}
            deleteSection={deleteSection}
            moveSection={moveSection}
            reorderSection={reorderSection}
            toggleHidden={toggleHidden}
            updateActivePage={updateActivePage}
            updateSelectedSection={updateSelectedSection}
            updateSelectedStyle={updateSelectedStyle}
          />
        )}
        {state.activeView === "analytics" && <Analytics state={state} setState={setState} />}
        {state.activeView === "settings" && (
          <Settings
            state={state}
            setState={setState}
            onChangePassword={handleChangePassword}
            onSendResetPassword={handleSendResetPassword}
            onInviteMember={handleInviteMember}
            onRemoveMember={handleRemoveMember}
            onRemoveInvite={handleRemoveInvite}
          />
        )}
        {state.activeView === "blueprint" && <Blueprint />}
      </main>
      <div className={`toast ${state.toast ? "is-visible" : ""}`} role="status" aria-live="polite">{state.toast}</div>
    </div>
  );
}

function Dashboard({ page, domain, setView, addPage }) {
  return (
    <>
      <div className="grid cols-3">
        <div className="metric"><span>Page views</span><strong>{page.views.toLocaleString("id-ID")}</strong><small>30 hari terakhir</small></div>
        <div className="metric"><span>CTA CTR</span><strong>{page.ctr}%</strong><small>Klik tombol utama</small></div>
        <div className="metric"><span>Leads</span><strong>{page.leads}</strong><small>Form submissions</small></div>
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Mulai cepat</h2>
          <p>Buat landing page sederhana, mobile-first, dan conversion-oriented untuk traffic Facebook dan Instagram Ads.</p>
          <div className="row-actions">
            <button className="primary-btn" onClick={() => addPage()}>New Page</button>
            <button className="ghost-btn" onClick={() => setView("templates")}>Lihat Template</button>
            <button className="ghost-btn" onClick={() => setView("editor")}>Buka Builder</button>
          </div>
        </article>
        <article className="card">
          <h2>Publish target</h2>
          <p><strong>{domain}/{page.slug}</strong></p>
          <p className="muted">Pre-render HTML, critical CSS inline, image compression otomatis, dan script pihak ketiga dibatasi.</p>
        </article>
      </div>
    </>
  );
}

function Pages({ pages, domain, editPage, duplicatePage, addPage }) {
  return (
    <div className="card">
      <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2>List landing page</h2>
          <p className="muted">Kelola draft, duplicate campaign, dan publish link untuk iklan.</p>
        </div>
        <button className="primary-btn" onClick={() => addPage()}>Create New Page</button>
      </div>
      <div className="page-list">
        {pages.map((page) => (
          <div className="page-row" key={page.id}>
            <div>
              <strong>{page.name}</strong>
              <p className="muted">{domain}/{page.slug} · {page.template}</p>
            </div>
            <div className="row-actions">
              <span className="status">{page.status}</span>
              {page.status === "Published" && (
                <a className="tiny-btn" href={`https://${normalizePublishDomain(domain)}/${page.slug}/`} target="_blank" rel="noreferrer">Visit Page</a>
              )}
              <button className="tiny-btn" onClick={() => editPage(page.id)}>Edit</button>
              <button className="tiny-btn" onClick={() => duplicatePage(page.id)}>Duplicate</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Templates({ addPage }) {
  return (
    <div className="grid cols-3">
      {templates.map((template) => (
        <article className="card template-card" key={template.id}>
          <div className="template-preview" aria-hidden="true">
            <div className="mini-hero"></div>
            <div className="mini-line"></div>
            <div className="mini-line" style={{ width: "76%" }}></div>
            <div className="mini-button"></div>
          </div>
          <div>
            <h3>{template.name}</h3>
            <p>{template.category}</p>
            <p className="muted">{template.goal}</p>
          </div>
          <button className="primary-btn" onClick={() => addPage(template)}>Use Template</button>
        </article>
      ))}
    </div>
  );
}

function AuthScreen({ state, setState, onSubmit }) {
  const isLogin = state.authMode === "login";
  const isForgot = state.authMode === "forgot";
  const isRegistered = state.authMode === "registered";
  const hasInvite = Boolean(getInviteEmailFromUrl());
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <span className="brand-mark">LP</span>
          <div className="brand-copy">
            <strong>LandingPro</strong>
            <small>{publicDomain}</small>
          </div>
        </div>
        <div>
          <p className="eyebrow">Supabase Auth</p>
          <h1>{isRegistered ? "Cek email kamu" : isForgot ? "Reset password" : isLogin ? "Login builder" : "Buat akun builder"}</h1>
          <p className="muted">{isRegistered ? `Kami sudah membuat permintaan akun untuk ${state.authEmail}. Buka email dari Supabase, klik link konfirmasi, lalu kembali login.` : hasInvite ? "Email kamu sudah diundang. Register atau login memakai email ini untuk masuk workspace tim." : isForgot ? "Kirim link reset password ke email akun builder." : "Masuk untuk menyimpan landing page, mengaktifkan RLS per user, dan publish HTML statis ke Storage."}</p>
        </div>
        {isRegistered ? (
          <div className="auth-confirmation">
            <strong>{state.authEmail}</strong>
            <p className="muted">Kalau email belum terlihat, cek folder spam atau promotion. Setelah konfirmasi, gunakan tombol login di bawah.</p>
          </div>
        ) : (
          <form className="form-grid" onSubmit={onSubmit}>
            <TextField
              label="Email"
              value={isForgot ? state.resetEmail : state.authEmail}
              onChange={(value) => setState((current) => isForgot ? { ...current, resetEmail: value } : { ...current, authEmail: value })}
            />
            {!isForgot && (
              <div className="field">
                <label>Password</label>
                <input type="password" value={state.authPassword} onChange={(event) => setState((current) => ({ ...current, authPassword: event.target.value }))} />
              </div>
            )}
            <button className="primary-btn" type="submit" disabled={state.authBusy}>{state.authBusy ? "Processing..." : isForgot ? "Kirim Link Reset" : isLogin ? "Login" : "Register"}</button>
          </form>
        )}
        <div className="row-actions auth-actions">
          <button
            className="ghost-btn"
            onClick={() => setState((current) => ({ ...current, authBusy: false, authMode: isLogin ? "register" : "login" }))}
          >
            {isLogin ? "Buat akun baru" : "Saya sudah punya akun"}
          </button>
          {!isRegistered && (
            <button
              className="ghost-btn"
              onClick={() => setState((current) => ({ ...current, authBusy: false, authMode: isForgot ? "login" : "forgot", resetEmail: current.resetEmail || current.authEmail }))}
            >
              {isForgot ? "Kembali login" : "Lupa password"}
            </button>
          )}
        </div>
        <p className="muted">Status: {state.dbStatus}</p>
      </section>
    </main>
  );
}

function Editor(props) {
  const { state, page, selected, setState, patch, addSection, cloneSection, deleteSection, moveSection, reorderSection, toggleHidden, updateActivePage, updateSelectedSection, updateSelectedStyle } = props;
  return (
    <div className="editor-layout">
      <aside className="elementor-panel builder-panel">
        <div className="panel-tabs">
          {["widgets", "navigator", "page"].map((tab) => (
            <button key={tab} className={state.builderPanel === tab ? "is-active" : ""} onClick={() => patch((draft) => { draft.builderPanel = tab; })}>{capitalize(tab)}</button>
          ))}
        </div>
        {state.builderPanel === "widgets" && (
          <div className="panel-body is-visible">
            <div className="panel-heading">
              <h2>Elements</h2>
              <p className="muted">Klik widget untuk menambah section ke canvas.</p>
            </div>
            <div className="block-grid">
              {blockCatalog.map((block) => (
                <button
                  className="widget-tile"
                  draggable
                  key={block.type}
                  onClick={() => addSection(block.type)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("application/x-landingpro-widget", block.type);
                    event.dataTransfer.setData("text/plain", `widget:${block.type}`);
                  }}
                >
                  <span className="widget-icon">{block.label.slice(0, 1)}</span>
                  <span>{block.label}<small>{block.hint}</small></span>
                </button>
              ))}
            </div>
          </div>
        )}
        {state.builderPanel === "navigator" && (
          <Navigator
            state={state}
            page={page}
            selected={selected}
            setState={setState}
            patch={patch}
            cloneSection={cloneSection}
            deleteSection={deleteSection}
            moveSection={moveSection}
            reorderSection={reorderSection}
            addSection={addSection}
            toggleHidden={toggleHidden}
          />
        )}
        {state.builderPanel === "page" && (
          <div className="panel-body is-visible">
            <div className="panel-heading">
              <h2>Page Settings</h2>
              <p className="muted">Pengaturan global halaman campaign.</p>
            </div>
            <div className="form-grid">
              <TextField label="Page name" value={page.name} onChange={(value) => updateActivePage("name", value)} />
              <TextField label="Slug" value={page.slug} onChange={(value) => updateActivePage("slug", value)} />
              <TextField label="SEO title" value={page.seoTitle} onChange={(value) => updateActivePage("seoTitle", value)} />
              <TextField label="SEO description" textarea value={page.seoDescription} onChange={(value) => updateActivePage("seoDescription", value)} />
            </div>
          </div>
        )}
      </aside>

      <section className="preview-panel elementor-canvas">
        <div className="editor-toolbar">
          <div className="segmented" aria-label="Preview mode">
            {["mobile", "tablet", "desktop"].map((mode) => (
              <button key={mode} className={state.previewMode === mode ? "is-active" : ""} onClick={() => patch((draft) => { draft.previewMode = mode; })}>
                {mode === "mobile" ? "Phone" : capitalize(mode)}
              </button>
            ))}
          </div>
          <div className="row-actions">
            <span className="status">Autosaved</span>
            <span className="muted">Target: HTML &lt; 60KB, JS &lt; 20KB</span>
          </div>
        </div>
        <div className="preview-frame">
          <LandingPreview
            page={page}
            previewMode={state.previewMode}
            selectedId={state.selectedSectionId}
            onSelect={(id) => patch((draft) => { draft.selectedSectionId = id; })}
            cloneSection={cloneSection}
            deleteSection={deleteSection}
            toggleHidden={toggleHidden}
            addSection={addSection}
          />
        </div>
      </section>

      <aside className="inspector elementor-panel">
        <div className="panel-heading inspector-heading">
          <div>
            <p className="eyebrow">Selected section</p>
            <h2>{labelForType(selected.type)}</h2>
          </div>
          <span className="status">{selected.style.hidden ? "Hidden" : "Visible"}</span>
        </div>
        <div className="panel-tabs">
          {["content", "style", "advanced"].map((tab) => (
            <button key={tab} className={state.inspectorTab === tab ? "is-active" : ""} onClick={() => patch((draft) => { draft.inspectorTab = tab; })}>{capitalize(tab)}</button>
          ))}
        </div>
        <Inspector selected={selected} tab={state.inspectorTab} updateSelectedSection={updateSelectedSection} updateSelectedStyle={updateSelectedStyle} cloneSection={cloneSection} deleteSection={deleteSection} />
      </aside>
    </div>
  );
}

function Navigator({ state, page, selected, setState, patch, cloneSection, deleteSection, moveSection, reorderSection, addSection, toggleHidden }) {
  function updateDropTarget(event, sectionId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-landingpro-widget") ? "copy" : "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY - rect.top > rect.height / 2 ? "after" : "before";
    setState((current) => (
      current.dropTargetId === sectionId && current.dropPosition === position
        ? current
        : { ...current, dropTargetId: sectionId, dropPosition: position }
    ));
  }

  function handleDrop(event, sectionId = null) {
    event.preventDefault();
    event.stopPropagation();
    const widgetType = event.dataTransfer.getData("application/x-landingpro-widget");
    const sectionIdFromDrag = event.dataTransfer.getData("text/plain");
    const position = state.dropTargetId === sectionId ? state.dropPosition : "after";

    if (widgetType) {
      addSection(widgetType, sectionId, position);
      return;
    }

    reorderSection(sectionIdFromDrag || state.draggedSectionId, sectionId, position);
  }

  return (
    <div className="panel-body is-visible">
      <div className="panel-heading">
        <h2>Navigator</h2>
        <p className="muted">Tarik widget ke sini untuk menambahkan, atau tarik handle layer untuk reorder.</p>
      </div>
      <div
        className="section-list navigator-dropzone"
        onDragOver={(event) => {
          if (event.currentTarget === event.target) {
            event.preventDefault();
            event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-landingpro-widget") ? "copy" : "move";
          }
        }}
        onDrop={(event) => {
          if (event.currentTarget === event.target) handleDrop(event, null);
        }}
      >
        {page.sections.map((section, index) => (
          <div
            className={[
              "section-item",
              section.id === selected.id ? "is-selected" : "",
              state.draggedSectionId === section.id ? "is-dragging" : "",
              state.dropTargetId === section.id && state.dropPosition === "before" ? "drop-before" : "",
              state.dropTargetId === section.id && state.dropPosition === "after" ? "drop-after" : ""
            ].filter(Boolean).join(" ")}
            key={section.id}
            onDragOver={(event) => updateDropTarget(event, section.id)}
            onDrop={(event) => handleDrop(event, section.id)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setState((current) => ({ ...current, dropTargetId: null, dropPosition: null }));
              }
            }}
          >
            <button className="layer-title" onClick={() => patch((draft) => { draft.selectedSectionId = section.id; })}>
              <span className="layer-number">{index + 1}</span>
              <span className="layer-copy">
                <strong>{labelForType(section.type)}</strong>
                {section.style.hidden && <em>Hidden</em>}
              </span>
            </button>
            <div className="layer-actions">
              <span
                className="drag-handle"
                draggable
                title="Drag section"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", section.id);
                  setState((current) => ({ ...current, draggedSectionId: section.id, dropTargetId: null, dropPosition: null }));
                }}
                onDragEnd={() => setState((current) => ({ ...current, draggedSectionId: null, dropTargetId: null, dropPosition: null }))}
              >
                ⋮⋮
              </span>
              <button className="icon-btn" title="Move up" onClick={() => moveSection(section.id, -1)}>↑</button>
              <button className="icon-btn" title="Move down" onClick={() => moveSection(section.id, 1)}>↓</button>
              <button className="icon-btn" title="Clone section" onClick={() => cloneSection(section.id)}>⧉</button>
              <button className="icon-btn" title="Hide section" onClick={() => toggleHidden(section.id)}>{section.style.hidden ? "◐" : "●"}</button>
              <button className="icon-btn danger-btn" title="Delete section" onClick={() => deleteSection(section.id)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Inspector({ selected, tab, updateSelectedSection, updateSelectedStyle, cloneSection, deleteSection }) {
  if (tab === "style") {
    return (
      <div className="panel-body is-visible">
        <div className="form-grid">
          <ColorField label="Background" value={selected.style.background} onChange={(value) => updateSelectedStyle("background", value)} />
          <ColorField label="Text color" value={selected.style.textColor} onChange={(value) => updateSelectedStyle("textColor", value)} />
          <ColorField label="Button/accent" value={selected.style.accentColor} onChange={(value) => updateSelectedStyle("accentColor", value)} />
          <div className="field">
            <label>Alignment</label>
            <select value={selected.style.align} onChange={(event) => updateSelectedStyle("align", event.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <RangeField label={`Padding ${selected.style.padding}px`} min="16" max="80" value={selected.style.padding} onChange={(value) => updateSelectedStyle("padding", Number(value))} />
          <RangeField label={`Radius ${selected.style.radius}px`} min="0" max="28" value={selected.style.radius} onChange={(value) => updateSelectedStyle("radius", Number(value))} />
        </div>
      </div>
    );
  }

  if (tab === "advanced") {
    return (
      <div className="panel-body is-visible">
        <div className="form-grid">
          <label className="toggle-row">
            <input type="checkbox" checked={selected.style.hidden} onChange={(event) => updateSelectedStyle("hidden", event.target.checked)} />
            <span>Hide section on published page</span>
          </label>
          <button className="ghost-btn" onClick={() => cloneSection(selected.id)}>Clone Section</button>
          <button className="danger-btn" onClick={() => deleteSection(selected.id)}>Delete Section</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-body is-visible">
      <div className="form-grid">
        {selected.type === "header" && (
          <>
            <RichTextEditor label="Judul" value={selected.title} onChange={(value) => updateSelectedSection("title", value)} />
            <RichTextEditor label="Subjudul" value={selected.body} onChange={(value) => updateSelectedSection("body", value)} />
            <div className="field">
              <label>Level heading</label>
              <select value={selected.level} onChange={(event) => updateSelectedSection("level", event.target.value)}>
                <option value="h1">H1</option>
                <option value="h2">H2</option>
                <option value="h3">H3</option>
              </select>
            </div>
          </>
        )}
        {selected.type === "image" && (
          <>
            <ImageUploadField
              onUpload={async (file) => {
                const optimized = await optimizeImageFile(file);
                updateSelectedSection("src", optimized.src);
                updateSelectedSection("image", selected.image || optimized.alt);
                updateSelectedSection("optimizedInfo", optimized.info);
              }}
            />
            <TextField label="Image URL" value={selected.src} onChange={(value) => updateSelectedSection("src", value)} />
            <TextField label="Alt text" value={selected.image} onChange={(value) => updateSelectedSection("image", value)} />
            <TextField label="Caption" value={selected.caption} onChange={(value) => updateSelectedSection("caption", value)} />
            <RangeField label={`Ukuran gambar ${selected.imageSize}%`} min="30" max="100" value={selected.imageSize} onChange={(value) => updateSelectedSection("imageSize", Number(value))} />
            {selected.optimizedInfo && <p className="field-help">{selected.optimizedInfo}</p>}
          </>
        )}
        {selected.type === "text" && <RichTextEditor label="Teks" value={selected.body} onChange={(value) => updateSelectedSection("body", value)} />}
        {selected.type === "bulletList" && (
          <>
            <TextField label="Judul list" value={selected.title} onChange={(value) => updateSelectedSection("title", value)} />
            <TextField label="Icon bullet" value={selected.icon} onChange={(value) => updateSelectedSection("icon", value)} />
            <TextField label="Items, pisahkan dengan |" textarea value={selected.items} onChange={(value) => updateSelectedSection("items", value)} />
          </>
        )}
        {selected.type === "divider" && (
          <>
            <RangeField label={`Ketebalan ${selected.thickness}px`} min="1" max="8" value={selected.thickness} onChange={(value) => updateSelectedSection("thickness", Number(value))} />
            <div className="field">
              <label>Style garis</label>
              <select value={selected.dividerStyle} onChange={(event) => updateSelectedSection("dividerStyle", event.target.value)}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
          </>
        )}
        {selected.type === "button" && (
          <>
            <TextField label="Teks tombol" value={selected.cta} onChange={(value) => updateSelectedSection("cta", value)} />
            <TextField label="Icon tombol" value={selected.icon} onChange={(value) => updateSelectedSection("icon", value)} />
            <TextField label="Link" value={selected.link} onChange={(value) => updateSelectedSection("link", value)} />
            <label className="toggle-row">
              <input type="checkbox" checked={Boolean(selected.sticky)} onChange={(event) => updateSelectedSection("sticky", event.target.checked)} />
              <span>Jadikan sticky button</span>
            </label>
          </>
        )}
        {selected.type === "whatsappButton" && (
          <>
            <TextField label="Teks tombol" value={selected.cta} onChange={(value) => updateSelectedSection("cta", value)} />
            <TextField label="Icon tombol" value={selected.icon} onChange={(value) => updateSelectedSection("icon", value)} />
            <TextField label="Nomor WhatsApp" value={selected.phone} onChange={(value) => updateSelectedSection("phone", value)} />
            <TextField label="Pesan awal" textarea value={selected.message} onChange={(value) => updateSelectedSection("message", value)} />
            <label className="toggle-row">
              <input type="checkbox" checked={Boolean(selected.sticky)} onChange={(event) => updateSelectedSection("sticky", event.target.checked)} />
              <span>Jadikan sticky WhatsApp button</span>
            </label>
          </>
        )}
        {selected.type === "htmlCode" && <TextField label="HTML code" textarea value={selected.body} onChange={(value) => updateSelectedSection("body", value)} />}
      </div>
    </div>
  );
}

function LandingPreview({ page, previewMode, selectedId, onSelect, cloneSection, deleteSection, toggleHidden, addSection }) {
  const sticky = page.sections.find((section) => isStickyButton(section) && !section.style.hidden);
  return (
    <article
      className={`landing-preview ${previewMode}`}
      onDragOver={(event) => {
        if (hasDraggedWidget(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const widgetType = draggedWidgetType(event);
        if (!widgetType) return;
        event.preventDefault();
        addSection(widgetType);
      }}
    >
      {page.sections.map((section) => (
        <LandingSection key={section.id} section={section} selected={selectedId === section.id} onSelect={onSelect} cloneSection={cloneSection} deleteSection={deleteSection} toggleHidden={toggleHidden} addSection={addSection} />
      ))}
      {sticky && (
        <div className="sticky-cta">
          <a className={`lp-button ${sticky.type === "whatsappButton" ? "whatsapp-widget" : ""}`} style={{ background: sticky.style.accentColor }} href={buttonHref(sticky)} onClick={(event) => event.preventDefault()}>{sticky.icon} {sticky.cta}</a>
        </div>
      )}
    </article>
  );
}

function LandingSection({ section, selected, onSelect, cloneSection, deleteSection, toggleHidden, addSection }) {
  const style = {
    background: section.style.background,
    color: section.style.textColor,
    textAlign: section.style.align,
    padding: `${Number(section.style.padding)}px 22px`
  };
  const cls = `lp-section ${section.type === "header" ? "lp-hero" : ""} ${selected ? "is-selected" : ""} ${section.style.hidden ? "is-hidden-section" : ""}`;
  const buttonStyle = { background: section.style.accentColor };
  const cardRadius = { borderRadius: Number(section.style.radius) };
  const HeadingTag = section.level || "h1";
  const toolbar = (
    <div className="section-toolbar">
      <span>{labelForType(section.type)}</span>
      <button title="Clone" onClick={(event) => { event.stopPropagation(); cloneSection(section.id); }}>⧉</button>
      <button title="Hide" onClick={(event) => { event.stopPropagation(); toggleHidden(section.id); }}>{section.style.hidden ? "◐" : "●"}</button>
      <button title="Delete" className="section-delete-btn" onClick={(event) => { event.stopPropagation(); deleteSection(section.id); }}>×</button>
    </div>
  );

  return (
    <section
      className={cls}
      style={style}
      onClick={() => onSelect(section.id)}
      onDragOver={(event) => {
        if (hasDraggedWidget(event)) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const widgetType = draggedWidgetType(event);
        if (!widgetType) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY - rect.top > rect.height / 2 ? "after" : "before";
        addSection(widgetType, section.id, position);
      }}
    >
      {toolbar}
      {section.type === "header" && (
        <>
          <HeadingTag dangerouslySetInnerHTML={{ __html: richHtml(section.title) }}></HeadingTag>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: richHtml(section.body) }}></div>
        </>
      )}
      {section.type === "image" && (
        <figure className="image-widget" style={{ width: `${Number(section.imageSize || 100)}%` }}>
          {section.src ? <img src={section.src} alt={section.image} style={cardRadius} /> : <div className="lp-media" style={cardRadius} role="img" aria-label={section.image}></div>}
          {section.caption && <figcaption>{section.caption}</figcaption>}
        </figure>
      )}
      {section.type === "text" && <div className="text-widget rich-text" dangerouslySetInnerHTML={{ __html: richHtml(section.body) }}></div>}
      {section.type === "bulletList" && (
        <>
          <h2>{section.title}</h2>
          <div className="benefit-list">{splitItems(section.items).map((item) => <div className="benefit-item bullet-item" style={cardRadius} key={item}><span>{section.icon}</span><strong>{item}</strong></div>)}</div>
        </>
      )}
      {section.type === "divider" && (
        <div className="divider-widget" style={{ borderTopWidth: Number(section.thickness), borderTopStyle: section.dividerStyle, borderTopColor: section.style.accentColor }}></div>
      )}
      {section.type === "button" && (
        <a className="lp-button" style={buttonStyle} href={section.link || "#"} onClick={(event) => event.preventDefault()}>{section.icon} {section.cta}</a>
      )}
      {section.type === "whatsappButton" && (
        <a className="lp-button whatsapp-widget" style={buttonStyle} href={whatsappHref(section)} onClick={(event) => event.preventDefault()}>{section.icon} {section.cta}</a>
      )}
      {section.type === "htmlCode" && <div className="html-widget" dangerouslySetInnerHTML={{ __html: section.body }}></div>}
    </section>
  );
}

function Analytics({ state, setState }) {
  const metrics = [["Page views", 82, "3.280"], ["Unique visitors", 68, "2.480"], ["CTA clicks", 44, "604"], ["Form submits", 18, "192"], ["75% scroll", 35, "1.148"]];
  return (
    <div className="grid cols-2">
      <article className="card">
        <h2>Advertiser analytics</h2>
        <p className="muted">Fokus pada sinyal iklan: CTR tombol, form submission, scroll depth, source/UTM, dan conversion event.</p>
        <div className="analytics-bars">
          {metrics.map(([label, width, value]) => (
            <div className="bar" key={label}>
              <strong>{label}</strong>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${width}%` }}></span></span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="card">
        <h2>Tracking setup</h2>
        <div className="form-grid">
          <TextField label="Meta Pixel ID" value={state.pixelId} onChange={(value) => setState((current) => ({ ...current, pixelId: value }))} />
          <div className="field"><label>Conversion event</label><select><option>Lead</option><option>Purchase</option><option>Contact</option></select></div>
          <div className="field"><label>UTM source</label><input value="facebook / instagram" readOnly /></div>
        </div>
      </article>
    </div>
  );
}

function Settings({ state, setState, onChangePassword, onSendResetPassword, onInviteMember, onRemoveMember, onRemoveInvite }) {
  const isOwner = state.workspace?.owner_id === state.session?.user?.id;
  const pendingInvites = (state.invites || []).filter((invite) => !invite.accepted_at);

  async function copyInviteLink(email) {
    const link = inviteLinkForEmail(email);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setState((current) => ({ ...current, toast: "Invite link disalin." }));
    } catch {
      window.prompt("Copy invite link:", link);
    }
  }

  return (
    <div className="grid cols-2">
      <article className="card">
        <h2>Publish domain</h2>
        <p className="muted">Untuk penggunaan internal tim, semua landing page dipublish ke satu domain utama.</p>
        <div className="form-grid">
          <TextField label="Domain publish utama" value={state.domain} onChange={(value) => setState((current) => ({ ...current, domain: cleanHostname(value) || publicDomain }))} />
          <div className="field"><label>Publish mode</label><select><option>Static pre-render</option><option>Edge SSR</option></select></div>
          <div className="field"><label>CDN cache</label><select><option>On, purge on publish</option><option>Manual</option></select></div>
        </div>
      </article>
      <article className="card">
        <h2>Setup ringkas</h2>
        <p className="muted">Arahkan <strong>{state.domain || publicDomain}</strong> ke Cloudflare Worker publish. Setelah itu semua page akan hidup di format berikut:</p>
        <p><strong>https://{state.domain || publicDomain}/nama-slug/</strong></p>
        <p className="muted">Tidak perlu Cloudflare for SaaS atau custom hostname per user untuk penggunaan internal.</p>
      </article>
      <article className="card">
        <h2>Account security</h2>
        <p className="muted">Login sebagai <strong>{state.session?.user?.email || "user"}</strong>.</p>
        <form className="form-grid" onSubmit={onChangePassword}>
          <div className="field">
            <label>Password baru</label>
            <input type="password" value={state.newPassword} onChange={(event) => setState((current) => ({ ...current, newPassword: event.target.value }))} />
          </div>
          <div className="field">
            <label>Konfirmasi password</label>
            <input type="password" value={state.confirmPassword} onChange={(event) => setState((current) => ({ ...current, confirmPassword: event.target.value }))} />
          </div>
          <button className="primary-btn" type="submit">Ganti Password</button>
        </form>
        <form className="form-grid reset-form" onSubmit={onSendResetPassword}>
          <TextField label="Email reset password" value={state.resetEmail || state.session?.user?.email || ""} onChange={(value) => setState((current) => ({ ...current, resetEmail: value }))} />
          <button className="ghost-btn" type="submit">Kirim Link Reset Password</button>
        </form>
      </article>
      <article className="card user-management-card">
        <h2>User management</h2>
        <p className="muted">Kelola member workspace internal dengan email. Sistem tidak mengirim email otomatis; gunakan Copy Invite Link lalu kirim link tersebut ke user.</p>
        <div className="member-list">
          {(state.members || []).map((member) => (
            <div className="member-row" key={member.user_id}>
              <div>
                <strong>{member.user_id === state.session?.user?.id ? "You" : member.email || "Member"}</strong>
                <p className="muted">{member.email || (member.user_id === state.session?.user?.id ? state.session?.user?.email : member.user_id)}</p>
              </div>
              <div className="row-actions">
                <span className="status">{member.role}</span>
                {isOwner && member.user_id !== state.session?.user?.id && (
                  <button className="tiny-btn danger-btn" onClick={() => onRemoveMember(member.user_id)}>Remove</button>
                )}
              </div>
            </div>
          ))}
          {!state.members?.length && <p className="muted">Belum ada member di workspace ini.</p>}
        </div>
        <h3>Pending invites</h3>
        <div className="member-list">
          {pendingInvites.map((invite) => (
            <div className="member-row" key={invite.id}>
              <div>
                <strong>{invite.email}</strong>
                <p className="muted">Menunggu login/register dengan email ini</p>
              </div>
              <div className="row-actions">
                <span className="status">{invite.role}</span>
                <button className="tiny-btn" onClick={() => copyInviteLink(invite.email)}>Copy Invite Link</button>
                <a className="tiny-btn" href={`mailto:${invite.email}?subject=Invite LandingPro&body=${encodeURIComponent(`Halo, silakan register/login LandingPro lewat link ini:\n\n${inviteLinkForEmail(invite.email)}`)}`}>Email</a>
                {isOwner && (
                  <button className="tiny-btn danger-btn" onClick={() => onRemoveInvite(invite.id)}>Remove</button>
                )}
              </div>
            </div>
          ))}
          {!pendingInvites.length && <p className="muted">Tidak ada invite yang menunggu.</p>}
        </div>
        {isOwner ? (
          <form className="form-grid" onSubmit={onInviteMember}>
            <TextField label="Email member" value={state.inviteEmail} onChange={(value) => setState((current) => ({ ...current, inviteEmail: value }))} />
            <div className="field">
              <label>Role</label>
              <select value={state.memberRole} onChange={(event) => setState((current) => ({ ...current, memberRole: event.target.value }))}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="primary-btn" type="submit">Add Invite</button>
          </form>
        ) : (
          <p className="muted">Hanya owner workspace yang bisa menambahkan atau menghapus member.</p>
        )}
      </article>
    </div>
  );
}

function Blueprint() {
  const blocks = [
    ["1. Tujuan Produk", ["Menyelesaikan masalah marketer yang butuh halaman campaign cepat tanpa coding.", "Target user: advertiser Meta, UMKM, agensi kecil, ecommerce, creator produk digital, dan tim lead generation.", "Berbeda dari builder umum karena tidak mengejar website kompleks, melainkan halaman pendek yang cepat dibuka dan mudah di-scan.", "Simple + fast load penting karena traffic Meta mayoritas mobile, impulsif, dan mudah drop saat loading lambat."]],
    ["2. Positioning Produk", ["Bukan website builder serbaguna.", "Khusus landing page iklan yang cepat dibuat, cepat dibuka, dan mudah diduplikasi per campaign.", "Keunggulan utama: speed, simplicity, conversion focus."]],
    ["3. Fitur Utama MVP", ["Wajib MVP: create page, template library, section builder sederhana, edit teks/gambar/tombol/warna, form lead, sticky CTA, testimoni, FAQ, publish, duplicate, preview mobile/desktop, basic analytics, Meta Pixel, SEO basic, image compression, asset management ringan.", "Tunda: A/B testing kompleks, visual animation timeline, marketplace template, CRM penuh, multi-step funnel, heatmap, role permission detail, AI copywriter tingkat lanjut."]],
    ["4. Batasan Produk", ["Jangan masukkan blog engine, ecommerce checkout penuh, membership, page nesting, animation berat, video background auto-play, font terlalu banyak, widget pihak ketiga tidak terkendali.", "Fitur yang tampak keren tapi rendah prioritas: parallax, live chat berat, carousel rumit, desain bebas total seperti Figma, dan layout desktop kompleks."]],
    ["5. User Flow", ["Login/register, pilih template, edit section, isi copywriting dan visual, pasang pixel/script, preview mobile dan desktop, publish, dapat link landing page."]],
    ["6. Struktur Halaman Aplikasi", ["Login/register, dashboard, list landing page, create new page, editor, template gallery, analytics, domain/settings, billing."]],
    ["7. Blok Builder", ["Hero: headline, subheadline, media, CTA.", "Image + benefit: gambar, judul, bullet benefit.", "Product highlights: daftar fitur atau value.", "Testimoni: nama, quote, rating opsional.", "CTA section: teks, tombol, link.", "Form lead: field, label, webhook.", "FAQ: question/answer.", "Price/offer: harga, bonus, urgency.", "Countdown: deadline, label CTA.", "Footer: legal, kontak, privacy."]],
    ["8. Prinsip Desain", ["Mobile-first, clean UI, tidak ramai, editor mudah untuk user awam, output ringan, dekorasi minimal, scanning cepat, CTA jelas."]],
    ["9. Struktur Database", ["users: id, name, email, password_hash, plan, created_at.", "landing_pages: id, user_id, template_id, name, slug, status, seo_title, seo_description, pixel_id, published_at, storage_path.", "templates: id, name, category, thumbnail, schema_json.", "sections: id, landing_page_id, type, sort_order, content_json, style_json.", "assets: id, user_id, landing_page_id, url, mime, size, width, height, optimized_url.", "publish_settings: domain utama di environment/app settings untuk penggunaan internal.", "analytics_events: id, landing_page_id, visitor_id, event_name, utm_json, device, created_at.", "form_submissions: id, landing_page_id, payload_json, source, created_at."]],
    ["10. Logika Teknis Fast Load", ["Publish sebagai static HTML/pre-render, bukan render editor runtime.", "Lazy load gambar di bawah fold.", "Optimasi gambar ke WebP/AVIF, resize sesuai viewport, kompres saat upload.", "Minify CSS/JS, inline critical CSS, sisanya kecil.", "Batasi script pihak ketiga: Meta Pixel dan conversion script whitelist.", "Font system default atau subset satu font.", "CDN cache agresif dengan purge on publish.", "HTML ringan, section schema sederhana, tanpa framework besar di halaman published."]],
    ["11. Tech Stack", ["Simpel cepat: frontend React/Vite atau Next.js, backend Next API/Node, database Supabase Postgres, storage Supabase/S3, deploy Vercel/Cloudflare Pages, analytics internal event table, domain via Cloudflare.", "Scalable: Next.js/Remix, backend NestJS/Fastify, Postgres + Redis, S3/R2, queue untuk image optimization, CDN Cloudflare, analytics ClickHouse, domain automation Cloudflare API."]],
    ["12. Analytics & Tracking", ["Page views, unique visitors, CTR tombol, form submission, scroll depth, conversion tracking, source/UTM tracking, event tracking CTA, device split, referrer."]],
    ["13. Template Strategy", ["Lead generation, produk fisik, produk digital, advertorial, katalog singkat, WhatsApp conversion. Setiap template harus punya satu goal utama, mobile layout solid, dan section minimal."]]
  ];
  return (
    <div className="blueprint-layout">
      {blocks.map(([title, items]) => (
        <article className="blueprint-block" key={title}>
          <h3>{title}</h3>
          <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      ))}
    </div>
  );
}

function ImageUploadField({ onUpload }) {
  const [status, setStatus] = useState("");

  return (
    <div className="field">
      <label>Upload image</label>
      <input
        accept="image/*"
        type="file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setStatus("Mengoptimasi gambar...");
          try {
            await onUpload(file);
            setStatus("Gambar sudah di-resize dan dikompresi otomatis.");
          } catch (error) {
            setStatus(error.message || "Upload gagal.");
          } finally {
            event.target.value = "";
          }
        }}
      />
      {status && <p className="field-help">{status}</p>}
    </div>
  );
}

function RichTextEditor({ label, value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  }

  function addLink() {
    const url = window.prompt("Masukkan URL");
    if (!url) return;
    runCommand("createLink", url);
  }

  return (
    <div className="field rich-field">
      <label>{label}</label>
      <div className="rich-toolbar" aria-label={`${label} formatting`}>
        <button type="button" title="Bold" onClick={() => runCommand("bold")}>B</button>
        <button type="button" title="Italic" onClick={() => runCommand("italic")}><em>I</em></button>
        <button type="button" title="Underline" onClick={() => runCommand("underline")}><u>U</u></button>
        <button type="button" title="Bullet list" onClick={() => runCommand("insertUnorderedList")}>•</button>
        <button type="button" title="Align left" onClick={() => runCommand("justifyLeft")}>Left</button>
        <button type="button" title="Align center" onClick={() => runCommand("justifyCenter")}>Center</button>
        <button type="button" title="Align right" onClick={() => runCommand("justifyRight")}>Right</button>
        <button type="button" title="Justify" onClick={() => runCommand("justifyFull")}>Justify</button>
        <button type="button" title="Link" onClick={addLink}>Link</button>
        <button type="button" title="Clear formatting" onClick={() => runCommand("removeFormat")}>Tx</button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onBlur={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
}

function TextField({ label, value, onChange, textarea = false }) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} /> : <input value={value || ""} onChange={(event) => onChange(event.target.value)} />}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="field color-field">
      <label>{label}</label>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function RangeField({ label, min, max, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function getActivePage(draft) {
  return draft.pages.find((item) => item.id === draft.activePageId) || draft.pages[0];
}

function getSelectedSection(draft) {
  const target = getActivePage(draft);
  return target.sections.find((section) => section.id === draft.selectedSectionId) || target.sections[0];
}

function newPageFromTemplate(template = templates[0]) {
  const id = `lp-${Date.now()}`;
  return {
    id,
    name: `${template.name} Campaign`,
    slug: `${template.id}-${String(Date.now()).slice(-4)}`,
    status: "Draft",
    template: template.name,
    views: 0,
    ctr: 0,
    leads: 0,
    seoTitle: `${template.name} Campaign`,
    seoDescription: template.goal,
    sections: createSections(template.sections)
  };
}

function clonePage(source) {
  const clone = cloneData(source);
  clone.id = `lp-${Date.now()}`;
  clone.name = `${source.name} Copy`;
  clone.slug = `${source.slug}-copy`;
  clone.status = "Draft";
  clone.sections = clone.sections.map((section, index) => ({ ...section, id: `${section.type}-${Date.now()}-${index}` }));
  return clone;
}

function labelForType(type) {
  return blockCatalog.find((block) => block.type === type)?.label || type;
}

function cleanHostname(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function normalizePublishDomain(value) {
  const hostname = cleanHostname(value);
  if (!hostname || hostname === "lp.jualify.id") return publicDomain;
  return hostname;
}

function getInviteEmailFromUrl() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("invite") || "").trim().toLowerCase();
}

function inviteLinkForEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (typeof window === "undefined" || !normalizedEmail) return "";
  return `${window.location.origin}/?invite=${encodeURIComponent(normalizedEmail)}`;
}

function whatsappHref(section) {
  const phone = String(section.phone || "").replace(/\D/g, "");
  const message = encodeURIComponent(section.message || "");
  return `https://wa.me/${phone}${message ? `?text=${message}` : ""}`;
}

function buttonHref(section) {
  return section.type === "whatsappButton" ? whatsappHref(section) : section.link || "#";
}

function isStickyButton(section) {
  return Boolean(section?.sticky && ["button", "whatsappButton"].includes(section.type));
}

function richHtml(value) {
  const raw = String(value || "");
  const html = /<\/?[a-z][\s\S]*>/i.test(raw) ? raw : escapeHtml(raw);
  return sanitizeRichHtml(html);
}

function sanitizeRichHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function hasDraggedWidget(event) {
  return Array.from(event.dataTransfer.types || []).includes("application/x-landingpro-widget");
}

function optimizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("File harus berupa gambar."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Gambar tidak bisa diproses."));
      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);

        let src = canvas.toDataURL("image/webp", 0.78);
        if (!src.startsWith("data:image/webp")) {
          src = canvas.toDataURL("image/jpeg", 0.78);
        }

        const beforeKb = Math.round(file.size / 1024);
        const afterKb = Math.round((src.length * 0.75) / 1024);
        resolve({
          src,
          alt: file.name.replace(/\.[^.]+$/, ""),
          info: `Optimized: ${image.naturalWidth}x${image.naturalHeight} → ${width}x${height}, sekitar ${beforeKb}KB → ${afterKb}KB.`
        });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function draggedWidgetType(event) {
  if (!hasDraggedWidget(event)) return "";
  return event.dataTransfer.getData("application/x-landingpro-widget");
}

function splitItems(value) {
  return String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
}

function capitalize(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in strict privacy/file modes; the app should still render.
  }
}

function buildStaticHtml(page, domain, pixelId) {
  const visibleSections = page.sections.filter((section) => !section.style.hidden);
  const sticky = visibleSections.find(isStickyButton);

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeAttr(page.seoDescription)}">
    <title>${escapeHtml(page.seoTitle || page.name)}</title>
    <style>${publishedCss()}</style>
    ${pixelId ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${escapeJs(pixelId)}');fbq('track','PageView');</script>` : ""}
  </head>
  <body>
    <main class="landing-page" data-domain="${escapeAttr(domain)}">
      ${visibleSections.map(renderStaticSection).join("\n")}
    </main>
    ${sticky ? renderStaticSticky(sticky) : ""}
    <script>
      document.querySelectorAll('[data-track]').forEach(function(el){el.addEventListener('click',function(){window.fbq&&fbq('track',el.dataset.track);});});
    </script>
  </body>
</html>`;
}

function renderStaticSection(section) {
  const style = `background:${escapeAttr(section.style.background)};color:${escapeAttr(section.style.textColor)};text-align:${escapeAttr(section.style.align)};padding:${Number(section.style.padding)}px 22px`;
  if (section.type === "header") {
    const tag = ["h1", "h2", "h3"].includes(section.level) ? section.level : "h1";
    return `<section class="lp-section lp-hero" style="${style}"><${tag}>${richHtml(section.title)}</${tag}><div class="rich-text">${richHtml(section.body)}</div></section>`;
  }
  if (section.type === "image") {
    const media = section.src
      ? `<img src="${escapeAttr(section.src)}" alt="${escapeAttr(section.image)}" loading="lazy" decoding="async" style="border-radius:${Number(section.style.radius)}px">`
      : `<div class="lp-media" style="border-radius:${Number(section.style.radius)}px" role="img" aria-label="${escapeAttr(section.image)}"></div>`;
    return `<section class="lp-section" style="${style}"><figure class="image-widget" style="width:${Number(section.imageSize || 100)}%">${media}${section.caption ? `<figcaption>${escapeHtml(section.caption)}</figcaption>` : ""}</figure></section>`;
  }
  if (section.type === "text") {
    return `<section class="lp-section" style="${style}"><div class="text-widget rich-text">${richHtml(section.body)}</div></section>`;
  }
  if (section.type === "bulletList") {
    return `<section class="lp-section" style="${style}"><h2>${escapeHtml(section.title)}</h2><div class="benefit-list">${splitItems(section.items).map((item) => `<div class="benefit-item bullet-item" style="border-radius:${Number(section.style.radius)}px"><span>${escapeHtml(section.icon)}</span><strong>${escapeHtml(item)}</strong></div>`).join("")}</div></section>`;
  }
  if (section.type === "divider") {
    return `<section class="lp-section" style="${style}"><div class="divider-widget" style="border-top:${Number(section.thickness)}px ${escapeAttr(section.dividerStyle)} ${escapeAttr(section.style.accentColor)}"></div></section>`;
  }
  if (section.type === "button") {
    return `<section class="lp-section" style="${style}"><a class="lp-button" style="background:${escapeAttr(section.style.accentColor)}" data-track="Lead" href="${escapeAttr(section.link || "#")}">${escapeHtml(section.icon)} ${escapeHtml(section.cta)}</a></section>`;
  }
  if (section.type === "whatsappButton") {
    return `<section class="lp-section" style="${style}"><a class="lp-button whatsapp-widget" style="background:${escapeAttr(section.style.accentColor)}" data-track="Contact" href="${escapeAttr(whatsappHref(section))}">${escapeHtml(section.icon)} ${escapeHtml(section.cta)}</a></section>`;
  }
  if (section.type === "htmlCode") {
    return `<section class="lp-section" style="${style}"><div class="html-widget">${section.body || ""}</div></section>`;
  }
  return `<section class="lp-section" style="${style}"><p>${escapeHtml(section.body || "")}</p></section>`;
}

function renderStaticSticky(section) {
  const className = section.type === "whatsappButton" ? "lp-button whatsapp-widget" : "lp-button";
  return `<div class="sticky-cta"><a class="${className}" style="background:${escapeAttr(section.style.accentColor)}" data-track="${section.type === "whatsappButton" ? "Contact" : "Lead"}" href="${escapeAttr(buttonHref(section))}">${escapeHtml(section.icon)} ${escapeHtml(section.cta)}</a></div>`;
}

function publishedCss() {
  return `*{box-sizing:border-box}body{margin:0;background:#eef3f7;color:#17202a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.landing-page{max-width:480px;margin:0 auto;background:#fff;min-height:100vh}.lp-section{border-bottom:1px solid #edf2f5}.lp-section h1,.lp-section h2,.lp-section h3{margin:0 0 10px;line-height:1.12}.lp-section h1{font-size:32px}.lp-section h2{font-size:26px}.lp-section h3{font-size:22px}.lp-section p,.rich-text{margin:0 0 14px;line-height:1.55}.rich-text ul,.rich-text ol{margin:8px 0 14px;padding-left:22px}.rich-text a{color:inherit;text-decoration:underline}.lp-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:0;border-radius:8px;padding:10px 14px;color:#fff;text-decoration:none;font-weight:800}.lp-media{min-height:170px;background:linear-gradient(135deg,rgba(15,159,122,.2),rgba(47,111,237,.2)),linear-gradient(45deg,#dfe7ee,#fff);border:1px solid rgba(255,255,255,.25)}.image-widget{margin:0;max-width:100%}.image-widget img{display:block;width:100%;height:auto}.image-widget figcaption{margin-top:8px;color:#627081;font-size:13px}.text-widget{font-size:16px}.benefit-list{display:grid;gap:10px}.benefit-item{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #e3ebf1;background:#f9fbfd}.divider-widget{width:100%}.whatsapp-widget{background:#16a34a!important}.html-widget{max-width:100%;overflow:auto}.sticky-cta{position:fixed;z-index:20;left:50%;right:auto;bottom:0;width:min(480px,100%);transform:translateX(-50%);display:grid;padding:10px;background:rgba(255,255,255,.94);box-shadow:0 -12px 26px rgba(23,32,42,.12);backdrop-filter:blur(12px)}.sticky-cta .lp-button{width:100%}@media(min-width:760px){.landing-page{max-width:920px}.lp-section{padding-left:44px!important;padding-right:44px!important}.sticky-cta{width:min(920px,100%)}}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeJs(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
