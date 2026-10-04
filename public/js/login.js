"use strict";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const toggleButton = document.querySelector("#toggle-password");
const eyeSlash = document.querySelector("#eye-slash");
const loginButton = document.querySelector("#login-button");
const buttonLabel = document.querySelector("#button-label");
const buttonArrow = document.querySelector("#button-arrow");
const spinner = document.querySelector("#button-spinner");
const status = document.querySelector("#login-status");
const errorBanner = document.querySelector("#error-banner");
const errorTitle = document.querySelector("#error-title");
const errorMessage = document.querySelector("#error-message");
let submitting = false;

function setBusy(busy) {
  submitting = busy;
  form.setAttribute("aria-busy", String(busy));
  loginButton.disabled = busy;
  emailInput.disabled = busy;
  passwordInput.disabled = busy;
  toggleButton.disabled = busy;
  buttonLabel.textContent = busy ? "Signing in…" : "Log in";
  buttonArrow.toggleAttribute("hidden", busy);
  spinner.hidden = !busy;
  status.textContent = busy ? "Signing in. Please wait." : "";
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorBanner.hidden = false;
  errorBanner.focus();
}

function hidePassword() {
  passwordInput.type = "password";
  toggleButton.setAttribute("aria-label", "Show password");
  toggleButton.setAttribute("aria-pressed", "false");
  eyeSlash.setAttribute("hidden", "");
}

toggleButton.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  toggleButton.setAttribute("aria-label", show ? "Hide password" : "Show password");
  toggleButton.setAttribute("aria-pressed", String(show));
  eyeSlash.toggleAttribute("hidden", !show);
});

form.addEventListener("input", () => { errorBanner.hidden = true; });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;

  // Read before disabling fields. Never trim the password.
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  errorBanner.hidden = true;
  hidePassword();
  setBusy(true);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let navigating = false;

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        passwordInput.value = "";
        showError("Authentication failed", "Invalid email or password. Please try again.");
      } else if (response.status === 400) {
        showError("Check your details", "Enter a valid email address and password.");
      } else if (response.status === 429) {
        showError("Too many attempts", "Please wait before trying to sign in again.");
      } else {
        showError("Unable to sign in", "The service is unavailable. Please try again shortly.");
      }
      return;
    }

    // Match our backend's successful contract: HTTP 200 with { user }.
    // An HTML fallback or malformed response must not look like a login success.
    const data = await response.json();
    if (response.status !== 200 || !data || typeof data.user?.userId !== "string" || !data.user.userId) {
      throw new Error("Unexpected login response");
    }

    passwordInput.value = "";
    // The browser manages the HttpOnly session cookie. Store no credentials here.
    window.location.replace("/app.html");
    navigating = true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      showError("Request timed out", "The server took too long to respond. Please try again.");
    } else {
      showError("Unable to sign in", "Could not complete sign-in. Check your connection and try again.");
    }
  } finally {
    clearTimeout(timeout);
    if (!navigating) setBusy(false);
  }
});

// Reset a restored login document without persisting passwords or auth state.
window.addEventListener("pageshow", () => {
  setBusy(false);
  hidePassword();
});
