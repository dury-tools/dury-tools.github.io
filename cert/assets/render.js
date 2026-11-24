// Shared renderer for a partner status view.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const STEPS = ["Sales accreditations", "Competency application + demo", "Deployment accreditations + enrollment", "Deployment Certified"];
const SHORT = {"ZSA": "ZSA", "ZTSA": "ZTSA", "ZDA": "ZDA"};

function findCourse(list, course, t) {
  const needles = (t.match && t.match[course]) || [course.toLowerCase()];
  return (list || []).find(x => x.valid && needles.some(n => (x.course || "").toLowerCase().includes(n)));
}
function shortName(c) { return c.replace(/^(ZSA|ZTSA|ZDA)\s*-\s*Zoom\s*/i, "$1 · "); }
function daysAgo(d) { if (!d) return 999; return Math.floor((Date.now() - new Date(d + "T12:00:00")) / 864e5); }
function fmtDate(d) { if (!d) return ""; const x = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}); }

function trackBadge(t) {
  if (t.step === 4) return '<span class="badge b-done">Certified</span>';
  if (t.step === 3) return '<span class="badge b-active">Competency ✓</span>';
  if (t.step === 2) return '<span class="badge b-active">In progress</span>';
  return t.comp_ready.length || t.comp_partial.length ? '<span class="badge b-todo">Started</span>' : '<span class="badge b-none">Not started</span>';
}

function stepper(t) {
  return `<div class="stepper">${STEPS.map((s, i) => {
    const n = i + 1, cls = t.step === 4 ? "done" : n < t.step ? "done" : n === t.step ? "cur" : "";
    return `<div class="step ${cls}">${esc(s)}</div>`;
  }).join("")}</div>`;
}

function grid(view, t) {
  const comp = t.comp_courses, dep = t.dep_courses;
  const all = [...comp, ...dep];
  const att = (t.application?.attendees || []).map(a => a.toLowerCase());
  const rows = Object.entries(view.people).filter(([n, list]) => all.some(c => findCourse(list, c, t)) || att.some(a => a.includes(n.toLowerCase())));
  if (!rows.length) return `<div class="box"><b>No one at ${esc(view.partner)} holds a ${esc(t.label)} course yet.</b><div class="small">Start with ${comp.map(esc).join(" and ")}. Each sales person needs both.</div></div>`;
  rows.sort((a, b) => all.filter(c => findCourse(b[1], c, t)).length - all.filter(c => findCourse(a[1], c, t)).length);
  const cell = (list, c, first) => {
    const h = findCourse(list, c, t);
    if (!h) return `<td class="${first ? "sep" : ""}"><span class="dash">—</span></td>`;
    const fresh = daysAgo(h.completed) <= 3;
    return `<td class="${first ? "sep" : ""}"><span class="ck ${fresh ? "new" : ""}" title="${fresh ? "Recently completed" : "Complete"}">✓</span><span class="dt">${esc(fmtDate(h.completed))}</span></td>`;
  };
  const role = (list) => {
    const s = comp.every(c => findCourse(list, c, t)), d = dep.every(c => findCourse(list, c, t));
    if (s && d) return '<span class="role ok">Sales ✓ · Delivery ✓</span>';
    if (s) return '<span class="role ok">Sales ✓</span>';
    if (d) return '<span class="role ok">Delivery ✓</span>';
    const miss = comp.filter(c => !findCourse(list, c, t));
    return comp.some(c => findCourse(list, c, t)) ? `<span class="role">Needs ${esc(miss.map(shortName).join(", "))}</span>` : "";
  };
  return `<div class="gridwrap"><table class="grid">
    <tr><th rowspan="2">Person</th><th class="grp sep" colspan="${comp.length}">Sales Competency · 2 people need both</th><th class="grp sep" colspan="${dep.length}">Deployment · 2 people need</th></tr>
    <tr>${comp.map((c, i) => `<th class="${i ? "" : "sep"}">${esc(shortName(c))}</th>`).join("")}${dep.map((c, i) => `<th class="${i ? "" : "sep"}">${esc(shortName(c))}</th>`).join("")}</tr>
    ${rows.map(([n, list]) => `<tr><td>${esc(n)}${role(list)}</td>${comp.map((c, i) => cell(list, c, !i)).join("")}${dep.map((c, i) => cell(list, c, !i)).join("")}</tr>`).join("")}
  </table></div>
  <div class="legend"><span><span class="ck">✓</span> Complete</span><span><span class="ck new">✓</span> Completed in the last 3 days</span><span><span class="dash">—</span> Not yet</span></div>`;
}

function faq(t) {
  const qa = [
    ["I finished a course. Why don't I see it here?", "New completions can take up to 3 business days to reach Zoom's records, and this page refreshes daily. If it's been longer than that, post your completion certificate in your Tech Hub channel."],
    ["We already applied. Do we apply again?", "No. After your Sales Competency application is accepted, the next step is the demo, not another application. Deployment Certification is a separate application in the Partner Portal, and only after the competency is granted."],
    ["Do the same people need to do Sales and Deployment?", `No. The Sales Competency needs 2 people who each complete ${t.comp_courses.join(" and ")}. Deployment needs 2 delivery people with ${t.dep_courses.join(", ")}. They can be different people, and delivery folks can start their courses now.`],
    ["Who can submit the applications?", "Only Primary Contact, Executive Sponsor, Sales Lead, or Technical Sales Lead personas in the Partner Portal. One person submits for the whole team."],
    ["Where do updates come from?", "Sales Competency: zucompetencies@zoom.com. Deployment Certification: servicesprogram@zoom.com. Those emails are the final word on your status and deadlines."],
  ];
  return qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
}

function renderTrack(view, key) {
  const t = view.tracks[key];
  const app = t.application;
  const clocks = (t.clocks || []).map(c => `<div class="clock">⏰ ${esc(c.label)}: <b>${esc(fmtDate(c.date))}</b></div>`).join("");
  const appLine = app ? `<div class="small" style="margin-top:8px">Competency application: <b>${esc(app.status)}</b>${app.submitted ? `, submitted ${esc(fmtDate(app.submitted))}` : ""}</div>` : "";
  const links = Object.entries(t.links).map(([c, u]) => `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(c)}</a>` : `${esc(c)} <span class="small">(link coming soon)</span>`}</li>`).join("");
  return `<h3>${esc(t.label)} · Step ${t.step} of 4</h3>${stepper(t)}
    <div class="next ${t.step === 4 ? "done" : ""}"><div class="ic">${t.step === 4 ? "🎉" : "👉"}</div><div><div class="lbl">Your next step</div><div class="txt">${esc(t.next)}</div>${appLine}</div></div>
    ${clocks}
    <h3>Who holds what</h3>${grid(view, t)}
    <div class="cols" style="margin-top:18px">
      <div class="box"><h4>📚 Course links</h4><ul>${links}</ul><p class="small" style="margin:10px 0 0">📋 <a href="${esc(t.canvas)}" target="_blank" rel="noopener">${esc(t.label)} Certified: Step-by-Step Checklist</a></p></div>
      <div class="box"><h4>📨 Where to apply</h4><ul><li><b>Sales Competency:</b> application form, then demo. Emails from zucompetencies@zoom.com.</li><li><b>Deployment Certification:</b> Certification Enrollment Application in Zoom Up Overview at mypartnerportal.zoom.us. Emails from servicesprogram@zoom.com.</li></ul></div>
    </div>
    <h3>Common questions</h3><div class="box">${faq(t)}</div>`;
}

function renderPartner(el, view, internalExtra) {
  const keys = Object.keys(view.tracks);
  const focus = view.focus || [];
  const first = focus.find(k => keys.includes(k)) || keys.slice().sort((a, b) => view.tracks[b].step - view.tracks[a].step || view.tracks[b].comp_ready.length - view.tracks[a].comp_ready.length)[0];
  el.innerHTML = `<div class="card">
      <h1>${esc(view.partner)}</h1>
      <div class="meta">Partner tier: ${esc(view.tier || "Unknown")} · CAM: ${esc(view.cam || "Unknown")} · Zoom PSE: ${esc(view.pse || "Unknown")}</div>
      <div class="fresh"><i></i>Data as of ${esc(view.updated)} · refreshes daily · new completions can take up to 3 business days to appear</div>
      ${internalExtra || ""}
      <div class="tiles">${keys.map(k => { const t = view.tracks[k]; return `<button class="tile" data-k="${k}">
        <div class="tn">${esc(t.label)} ${focus.includes(k) ? '<span class="badge b-focus">Focus</span>' : trackBadge(t)}</div>
        <div class="st">Step ${t.step} <span>of 4</span></div><div class="small">${esc(STEPS[t.step - 1])}</div>
        <div class="dots">${[1, 2, 3, 4].map(n => `<i class="${t.step === 4 || n < t.step ? "d" : n === t.step ? "f" : ""}"></i>`).join("")}</div></button>`; }).join("")}</div>
      <div id="trk"></div></div>
    <div class="card owner"><b>Who owns this process:</b> The Zoom Competency Team (zucompetencies@zoom.com) runs the Sales Competency, and the Services Program team (servicesprogram@zoom.com) runs Deployment Certification. Their emails are the final word. Questions? Ask in your Tech Hub channel.</div>`;
  const trk = el.querySelector("#trk");
  const show = k => { trk.innerHTML = renderTrack(view, k); el.querySelectorAll(".tile").forEach(b => b.classList.toggle("on", b.dataset.k === k)); };
  el.querySelectorAll(".tile").forEach(b => b.addEventListener("click", () => show(b.dataset.k)));
  show(first);
}
