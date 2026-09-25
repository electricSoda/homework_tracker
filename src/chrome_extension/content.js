const target = document.querySelector("#sidebar");

if (target) {
    const iframe = document.createElement("iframe");

    iframe.src = "https://example.com";
    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.border = "none";

    target.replaceChildren(iframe);
}