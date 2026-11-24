// Shared renderer for a partner status view.
const STATE = {done: "Complete", active: "In progress", ready: "Ready", todo: "To do", locked: "Locked"};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

function link(course, url) {
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(course)}</a>` : esc(course);
}

function findCourse(list, course, t) {
  const needles = (t.match && t.match[course]) || [course.toLowerCase()];
  return (list || []).find(x => x.valid && needles.some(n => (x.course || "").toLowerCase().includes(n)));
}
const hasCourse = (list, c, t) => !!findCourse(list, c, t);

function phaseBox(title, ph, readyCount, need, sub) {
  const pct = ph.state === "done" ? 100 : Math.min(100, Math.round((readyCount / need) * 100));
  return `<div class="phase ${ph.state}">
    <span class="pill ${ph.state}">${STATE[ph.state]}</span>
    <h2>${esc(title)}</h2>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="small">${readyCount} of ${need} people fully accredited</div>
    <p>${esc(ph.text)}</p>${sub || ""}</div>`;
}

function peopleTable(view, t) {
  const courses = [...t.comp_courses, ...t.dep_courses];
  const rows = Object.entries(view.people).filter(([n, list]) =>
    courses.some(c => hasCourse(list, c, t)) || (t.application?.attendees || []).some(a => a.toLowerCase().includes(n.toLowerCase())));
  if (!rows.length) return `<p class="small">No one at ${esc(view.partner)} holds a ${esc(t.label)} course yet.</p>`;
  return `<table><tr><th>Person</th>${courses.map(c => `<th>${esc(c)}</th>`).join("")}</tr>
    ${rows.map(([n, list]) => `<tr><td>${esc(n)}</td>${courses.map(c => {
      const hit = findCourse(list, c, t);
      return `<td>${hit ? `<span class="y">✓</span> <span class="small">${esc(hit.completed)}</span>` : '<span class="n">—</span>'}</td>`;
    }).join("")}</tr>`).join("")}</table>`;
}

function renderTrack(view, key) {
  const t = view.tracks[key];
  const app = t.application;
  const appLine = app ? `<div class="small">Asana application: <b>${esc(app.status)}</b>, submitted ${esc(app.submitted)}${app.attendees?.length ? `, attendees ${esc(app.attendees.join(", "))}` : ""}</div>` : "";
  const clocks = (t.clocks || []).map(c => `<div class="clock">⏰ ${esc(c.label)}: <b>${esc(c.date)}</b></div>`).join("");
  return `<div class="chain">
      ${phaseBox("Phase 1 · " + t.comp_name, t.phase1, Math.min(2, t.comp_ready.length), 2, appLine)}
      <div class="arrow">➜</div>
      ${phaseBox("Phase 2 · " + t.dep_name, t.phase2, Math.min(2, t.dep_ready.length), 2, "")}
    </div>${clocks}
    <h3>Next steps</h3>
    ${t.steps.length ? `<ol>${t.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : "<p>Nothing open. 🎉</p>"}
    <h3>Who holds what</h3>${peopleTable(view, t)}
    ${t.comp_partial.length || t.dep_partial.length ? `<p class="small">Almost there: ${[...t.comp_partial, ...t.dep_partial].map(p => `${esc(p.name)} still needs ${esc(p.missing)}`).join("; ")}.</p>` : ""}
    <h3>Course links</h3>
    <p>${Object.entries(t.links).map(([c, u]) => link(c, u) + (u ? "" : " <span class='small'>(link coming soon)</span>")).join(" · ")}</p>
    <p>📋 <a href="${esc(t.canvas)}" target="_blank" rel="noopener">${esc(t.label)} Certified: Step-by-Step Checklist</a></p>`;
}

function renderPartner(el, view, internalExtra) {
  const keys = Object.keys(view.tracks);
  el.innerHTML = `<div class="card">
      <h1>${esc(view.partner)}</h1>
      <div class="meta">Tier: ${esc(view.tier || "Unknown")} · CAM: ${esc(view.cam || "Unknown")} · PSE: ${esc(view.pse || "Unknown")} · Data refreshed ${esc(view.updated)}</div>
      ${internalExtra || ""}
      <div class="tabs">${keys.map((k, i) => `<button class="tab ${i ? "" : "on"}" data-k="${k}">${esc(view.tracks[k].label)}</button>`).join("")}</div>
      <div id="trk"></div></div>
    <div class="card owner"><b>Who owns this process:</b> Sales Competency is run by the Zoom Competency Team (zucompetencies@zoom.com). Deployment Certification is run by the Services Program team (servicesprogram@zoom.com). Their emails are the final word, and every next step arrives from them. New course completions can take 24 to 48 hours to show up here.</div>`;
  const trk = el.querySelector("#trk");
  const show = k => { trk.innerHTML = renderTrack(view, k); el.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.k === k)); };
  el.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => show(b.dataset.k)));
  show(keys[0]);
}
