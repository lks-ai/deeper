/**
 * Injects the Google Tag Manager code into the page.
 * @param {string} trackingId - The GTM tracking ID (e.g., 'GTM-5898ZJMX').
 */
function setupGoogleTagManager(trackingId) {
  // Do not inject if running on localhost.
  const hostname = window.location.hostname;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(hostname)) {
    console.log("Google Tag Manager not loaded on localhost.");
    return;
  }

  // Create the GTM script for the <head>
  const gtmScript = document.createElement('script');
  gtmScript.innerHTML = `
    (function(w,d,s,l,i){
      w[l]=w[l]||[];
      w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
      var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),
          dl=l!='dataLayer'?'&l='+l:'';
      j.async=true;
      j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
      f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${trackingId}');
  `;
  // Append the script element to the <head>
  document.head.appendChild(gtmScript);

  // Create the noscript element for the <body>
  const noscriptTag = document.createElement('noscript');
  noscriptTag.innerHTML = `
    <iframe src="https://www.googletagmanager.com/ns.html?id=${trackingId}"
      height="0" width="0" style="display:none;visibility:hidden"></iframe>
  `;
  // Insert the noscript as the first child of the <body>
  document.body.insertBefore(noscriptTag, document.body.firstChild);
}

// Example usage:
//setupGoogleTagManager("GTM-5898ZJMX");
