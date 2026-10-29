"use strict";

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const loadButton = document.querySelector("#load-btn");
const submitButton = document.querySelector("#submit-btn");
const noteForm = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const statusMessage = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");

let notes = [];
let isBusy = false;

function setStatus(message, state = "") {
  statusMessage.textContent = message;
  if (state) {
    statusMessage.dataset.state = state;
  } else {
    delete statusMessage.dataset.state;
  }
}

function setBusy(busy) {
  isBusy = busy;
  loadButton.disabled = busy;
  submitButton.disabled = busy;
  notesList.querySelectorAll(".delete-btn").forEach((button) => {
    button.disabled = busy;
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server responded with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  const data = response.status === 204 ? null : await response.json();
  return { data, status: response.status };
}

function createNoteCard(note) {
  const card = document.createElement("li");
  card.className = "note-card";
  card.dataset.id = String(note.id);

  const title = document.createElement("h3");
  title.textContent = note.title || "Untitled note";

  const body = document.createElement("p");
  body.textContent = note.body || "No additional details.";

  const meta = document.createElement("div");
  meta.className = "note-meta";

  const identifier = document.createElement("span");
  identifier.textContent = `Note #${note.id}`;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.dataset.noteId = String(note.id);
  deleteButton.setAttribute("aria-label", `Delete note: ${note.title || "Untitled note"}`);
  deleteButton.disabled = isBusy;

  meta.append(identifier, deleteButton);
  card.append(title, body, meta);
  return card;
}

function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = "No notes to show yet. Load notes or create one.";
    notesList.append(emptyMessage);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    fragment.append(createNoteCard(note));
  }
  notesList.append(fragment);
}

async function loadNotes() {
  setBusy(true);
  setStatus("Loading notes…");

  try {
    const { data } = await request(`${API_URL}?_limit=10`);
    notes = Array.isArray(data) ? data : [];
    renderNotes();

    if (notes.length === 0) {
      setStatus("The server returned no notes.", "empty");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch {
    notes = [];
    renderNotes();
    setStatus("Could not load notes. Check your connection and try again.", "error");
  } finally {
    setBusy(false);
  }
}

loadButton.addEventListener("click", loadNotes);

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title) {
    setStatus("Please enter a title for your note.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus("Titles must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Creating note…");

  try {
    const { data, status } = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title, body, userId: 1 }),
    });

    const createdNote = data && data.id !== undefined
      ? data
      : { id: `local-${Date.now()}`, title, body, userId: 1 };
    notes.unshift(createdNote);
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${status}, id ${createdNote.id}).`, "success");
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
  } finally {
    setBusy(false);
  }
});

notesList.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element) || isBusy) return;

  const deleteButton = event.target.closest(".delete-btn");
  if (!deleteButton) return;

  const noteId = deleteButton.dataset.noteId;
  setBusy(true);
  setStatus("Deleting note…");

  try {
    await request(`${API_URL}/${encodeURIComponent(noteId)}`, { method: "DELETE" });
    notes = notes.filter((note) => String(note.id) !== noteId);
    renderNotes();

    // JSONPlaceholder acknowledges POST and DELETE but does not persist them; this removal is for the current page only.
    setStatus(`Note ${noteId} removed from this page. The practice API does not save changes.`, "success");
  } catch {
    setStatus("Could not delete the note. Please try again.", "error");
  } finally {
    setBusy(false);
  }
});

renderNotes();
