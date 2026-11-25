// Shared renderer for a partner status view.
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const STEPS = ["Sales accreditations", "Sales Competency", "Deployment accreditations", "Deployment Certified"];

function findCourse(list, course, t) {
  const needles = (t.match && t.match[course]) || [course.toLowerCase()];
  return (list || []).find(x => x.valid && needles.some(n => (x.course || "").toLowerCase().includes(n)));
}
function shortName(c) { return c.replace(/^(ZSA|ZTSA|ZDA)\s*-\s*Zoom\s*/i, "$1 · "); }
function daysAgo(d) { if (!d) return 999; return Math.floor((Date.now() - new Date(d + "T12:00:00")) / 864e5); }
function fmtDate(d) {
  if (!d) return "";
  const x = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
}
function fmtStatus(s) { return String(s || "").replace(/(\d{4}-\d{2}-\d{2})/g, m => fmtDate(m)); }

// One plain phrase per track. Green + trophy only for certified.
function stagePhrase(t) {
  if (t.step === 4) return {cls: "b-done", txt: "Deployment Certified 🏆"};
  if (t.step === 3) return {cls: "b-active", txt: "Competency ✓ · Not yet certified"};
  if (t.step === 2) {
    const a = t.application || {}, g = a.grade;
    const internal = typeof window !== "undefined" && window.CERT_INTERNAL;
    const txt = {
      applied: "Applied · Awaiting acceptance",
      accepted: "Accepted · Demo due" + (a.demo_due ? " " + fmtDate(a.demo_due) : ""),
      demo_submitted: "Demo submitted · Awaiting review",
      grading: "Demo submitted · Being graded",
      resubmit: internal ? `Resubmission needed${g ? " · " + g.score : ""}` : "Demo reviewed · Check your email",
      passed: internal ? `Demo passed${g ? " · " + g.score : ""}` : "Demo reviewed · Check your email",
      failed: internal ? "Competency failed" : "Demo reviewed · Check your email",
      rejected: internal ? "Application rejected" : "Check your email",
    }[a.stage] || "Applied";
    const warn = internal && ["resubmit", "failed", "rejected"].includes(a.stage);
    return {cls: warn ? "b-warn" : "b-active", txt};
  }
  return null;
}

function stepper(t) {
  return `<div class="stepper">${STEPS.map((s, i) => {
    const n = i + 1, cls = t.step === 4 || n < t.step ? "done" : n === t.step ? "cur" : "";
    const sub = (t.step_status || [])[i] || "";
    return `<div class="step ${cls}"><div class="sn">${esc(s)}</div><div class="ss">${esc(fmtStatus(sub))}</div></div>`;
  }).join("")}</div>`;
}

function reqLine(t) {
  const ok = n => n >= 2 ? `<b class="okc">You have ${n} ✓</b>` : `<b class="noc">You have ${n} of 2</b>`;
  return `<div class="req">
    <div>🎯 <b>Sales Competency:</b> 2 people, each with ${t.comp_courses.map(esc).join(" + ")} · ${ok(t.comp_ready.length)}</div>
    <div>🛠️ <b>Deployment:</b> 2 people with ${t.dep_courses.map(esc).join(" + ")} · ${ok(t.dep_ready.length)}</div>
  </div>`;
}

function grid(view, t) {
  const comp = t.comp_courses, dep = t.dep_courses, all = [...comp, ...dep];
  const att = (t.application?.attendees || []).map(a => a.toLowerCase());
  const rows = Object.entries(view.people).filter(([n, list]) => all.some(c => findCourse(list, c, t)) || att.some(a => a.includes(n.toLowerCase())));
  if (!rows.length) return `<div class="box"><b>No one at ${esc(view.partner)} holds a ${esc(t.label)} course yet.</b><div class="small">Start with ${comp.map(esc).join(" and ")}. Each sales person needs both.</div></div>`;
  rows.sort((a, b) => all.filter(c => findCourse(b[1], c, t)).length - all.filter(c => findCourse(a[1], c, t)).length);
  const cell = (list, c, first) => {
    const h = findCourse(list, c, t);
    if (!h) return `<td class="${first ? "sep" : ""}"><span class="dash" title="Not yet">—</span></td>`;
    const fresh = daysAgo(h.completed) <= 3;
    return `<td class="${first ? "sep" : ""}"><span class="ck">✓</span><span class="dt">${esc(fmtDate(h.completed))}${fresh ? ' <span class="newtag">New</span>' : ""}</span></td>`;
  };
  const role = (list) => {
    const s = comp.every(c => findCourse(list, c, t)), d = dep.every(c => findCourse(list, c, t));
    const tags = [];
    if (s) tags.push('<span class="role ok">Counts toward Sales Competency</span>');
    if (d) tags.push('<span class="role ok">Counts toward Deployment</span>');
    if (!s && comp.some(c => findCourse(list, c, t))) tags.push(`<span class="role">Needs ${esc(comp.filter(c => !findCourse(list, c, t)).map(shortName).join(", "))}</span>`);
    return tags.join("");
  };
  return `<div class="gridwrap"><table class="grid">
    <tr><th rowspan="2">Person</th><th class="grp sep" colspan="${comp.length}">Sales Competency courses</th><th class="grp sep" colspan="${dep.length}">Deployment courses</th></tr>
    <tr>${comp.map((c, i) => `<th class="${i ? "" : "sep"}">${esc(shortName(c))}</th>`).join("")}${dep.map((c, i) => `<th class="${i ? "" : "sep"}">${esc(shortName(c))}</th>`).join("")}</tr>
    ${rows.map(([n, list]) => `<tr><td>${esc(n)}${role(list)}</td>${comp.map((c, i) => cell(list, c, !i)).join("")}${dep.map((c, i) => cell(list, c, !i)).join("")}</tr>`).join("")}
  </table></div>
  <p class="small" style="margin-top:8px">✓ = completed (date shown) · — = not yet</p>`;
}

function applyBox(t) {
  let comp;
  if (t.step >= 3) comp = `<div class="ap done">✅ <b>Sales Competency granted</b></div>`;
  else if (t.application) {
    const a = t.application, extra = a.stage === "accepted" && a.demo_due ? ` Your demo is due <b>${esc(fmtDate(a.demo_due))}</b>.` : "";
    comp = `<div class="ap done">✅ <b>Applied for the Sales Competency</b> on ${esc(fmtDate(a.submitted))}.${extra} Don't re-apply. Next emails come from zucompetencies@zoom.com.</div>`;
  }
  else comp = `<div class="ap">${t.form ? `<a class="btn" href="${esc(t.form)}" target="_blank" rel="noopener">Apply for the ${esc(t.comp_name)} →</a>` : `<b>${esc(t.comp_name)} application:</b> confirm URL`}
      <div class="small" style="margin-top:6px">${t.comp_ready.length >= 2 ? "You have the 2 accredited people you need, so you're ready to apply." : `Apply once 2 people each hold ${t.comp_courses.map(esc).join(" + ")}.`} One person submits for the team. Emails come from zucompetencies@zoom.com.</div></div>`;
  const dep = t.step === 4 ? `<div class="ap done">🏆 <b>Deployment Certified</b></div>`
    : t.step === 3 ? `<div class="ap"><b>Deployment Certification:</b> log into <a href="https://mypartnerportal.zoom.us" target="_blank" rel="noopener">mypartnerportal.zoom.us</a> → Zoom Up Overview → <b>Certification Enrollment Application</b>. Emails come from servicesprogram@zoom.com.</div>`
    : `<div class="ap locked">🔒 <b>Deployment Certification</b> opens after the Sales Competency is granted. You apply in the Partner Portal (mypartnerportal.zoom.us → Zoom Up Overview → Certification Enrollment Application). Delivery folks can start ${t.dep_courses.map(esc).join(", ")} now.</div>`;
  return comp + dep;
}

function faq(t) {
  const qa = [
    ["I finished a course. Why don't I see it here?", "New completions can take up to 3 business days to reach Zoom's records, and this page refreshes every weekday morning. If it's been longer than that, post your completion certificate in your Tech Hub channel."],
    ["We already applied. Do we apply again?", "No. After your Sales Competency application is accepted, the next step is the demo, not another application. Deployment Certification is a separate application in the Partner Portal, and only after the competency is granted."],
    ["Do the same people need to do Sales and Deployment?", `No. The Sales Competency needs 2 people who each complete ${t.comp_courses.join(" and ")}. Deployment needs 2 delivery people with ${t.dep_courses.join(", ")}. They can be different people, and delivery folks can start their courses now.`],
    ["Who can submit the applications?", "Only Primary Contact, Executive Sponsor, Sales Lead, or Technical Sales Lead personas. One person submits for the whole team."],
    ["Where do updates come from?", "Sales Competency: zucompetencies@zoom.com. Deployment Certification: servicesprogram@zoom.com. Those emails are the final word on your status and deadlines."],
  ];
  return qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
}

function renderTrack(view, key) {
  const t = view.tracks[key];
  const clocks = (t.clocks || []).map(c => `<div class="clock">⏰ ${esc(c.label)}: <b>${esc(fmtDate(c.date))}</b></div>`).join("");
  const links = Object.entries(t.links).map(([c, u]) => `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(c)}</a>` : `${esc(c)} <span class="small">(confirm URL)</span>`}</li>`).join("");
  return `${stepper(t)}
    <div class="next ${t.step === 4 ? "done" : ""}"><div class="ic">${t.step === 4 ? "🎉" : "👉"}</div><div><div class="lbl">Your next step</div><div class="txt">${esc(t.next)}</div></div></div>
    ${clocks}
    <h3>Apply</h3>${applyBox(t)}
    <h3>Who holds what</h3>${grid(view, t)}
    <div class="cols" style="margin-top:18px">
      <div class="box"><h4>📚 Course links</h4><ul>${links}</ul></div>
      <div class="box"><h4>📋 Full checklist</h4><p style="margin:0"><a href="${esc(t.canvas)}" target="_blank" rel="noopener">${esc(t.label)} Certified: Step-by-Step Checklist</a></p></div>
    </div>
    <h3>Common questions</h3><div class="box">${faq(t)}</div>`;
}

function primaryTrack(view) {
  const keys = Object.keys(view.tracks);
  const pursuing = keys.filter(k => view.tracks[k].pursuing);
  const focus = (view.focus || []).find(k => keys.includes(k));
  if (pursuing.length) return pursuing.sort((a, b) => view.tracks[b].step - view.tracks[a].step)[0];
  if (focus) return focus;
  return keys.slice().sort((a, b) => view.tracks[b].comp_ready.length - view.tracks[a].comp_ready.length || (view.tracks[b].courses_taken || 0) - (view.tracks[a].courses_taken || 0))[0];
}

function renderPartner(el, view, internalExtra) {
  const keys = Object.keys(view.tracks);
  let cur = primaryTrack(view);
  const draw = () => {
    const t = view.tracks[cur];
    const others = keys.filter(k => k !== cur);
    const otherChip = k => {
      const o = view.tracks[k], ph = stagePhrase(o);
      const note = ph ? ph.txt : (o.courses_taken ? `${o.courses_taken} course${o.courses_taken === 1 ? "" : "s"} taken · not applied` : "Not started");
      return `<button class="chip ${ph ? "on" : ""}" data-k="${k}"><b>${esc(o.label)}</b> <span>${esc(note)}</span></button>`;
    };
    const ph = stagePhrase(t);
    const headline = ph ? ph.txt : t.comp_ready.length >= 2 ? "Courses done · Ready to apply" : (t.courses_taken ? "Taking courses · Not applied yet" : "Not started");
    el.innerHTML = `<div class="card">
      <h1>${esc(view.partner)}</h1>
      <div class="meta">Partner tier: ${esc(view.tier || "Unknown")} · CAM: ${esc(view.cam || "Unknown")} · Zoom PSE: ${esc(view.pse || "Unknown")}</div>
      <div class="fresh"><i></i>Data as of ${esc(view.updated)} · refreshes every weekday morning · new completions can take up to 3 business days to appear</div>
      ${internalExtra || ""}
      <div class="focus">
        <div class="fl">${t.pursuing ? "Working on now" : "Current track"}</div>
        <div class="fh"><h2>${esc(t.label)}</h2><span class="badge ${ph ? ph.cls : "b-none"}">${esc(headline)}</span></div>
        ${reqLine(t)}
      </div>
      ${others.length ? `<div class="also"><span class="small">Other tracks:</span> ${others.map(otherChip).join("")}</div>` : ""}
      <div id="trk">${renderTrack(view, cur)}</div></div>
    <div class="card owner"><b>Who owns this process:</b> The Zoom Competency Team (zucompetencies@zoom.com) runs the Sales Competency, and the Services Program team (servicesprogram@zoom.com) runs Deployment Certification. Their emails are the final word. Questions? Ask in your Tech Hub channel.</div>`;
    el.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => { cur = b.dataset.k; draw(); }));
  };
  draw();
}
