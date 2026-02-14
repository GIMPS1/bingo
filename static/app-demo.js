
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-deadlink]").forEach(a => {
    a.addEventListener("click", (e) => { e.preventDefault(); });
  });
  document.querySelectorAll("[data-deadbutton]").forEach(b => {
    b.addEventListener("click", (e) => { e.preventDefault(); });
  });
});
