/**
 * Dynamically loads the Google Analytics script.
 * @param {string} trackingId - Your Google Analytics tracking ID (e.g., 'UA-XXXXXX-X' or 'G-XXXXXXXXXX').
 * @param {Object} [configOptions={}] - Optional configuration options passed to gtag('config').
 */
function loadGoogleAnalytics(trackingId, configOptions = {}) {
    // Only load GA if not on a localhost environment.
    const hostname = window.location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/.test(hostname)) {
      console.log("Google Analytics not loaded on localhost.");
      return;
    }
  
    // Prevent duplicate script injection.
    if (document.querySelector(`script[src*="gtag/js?id=${trackingId}"]`)) {
      console.warn("Google Analytics script already loaded.");
      return;
    }
  
    // Create the GA script element.
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
    document.body.appendChild(script);
  
    // Initialize the dataLayer and gtag function.
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      dataLayer.push(arguments);
    };
  
    // Set up GA with the current time and any configuration options.
    gtag("js", new Date());
    gtag("config", trackingId, configOptions);
}

// Example usage:
// loadGoogleAnalytics("G-XXXXXXXXXX", { send_page_view: true });
