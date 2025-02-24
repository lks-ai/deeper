(function() {
  // Verify the JWT with your server.
  // Adjust the URL ('/auth') and response format as needed.
  // The useOAuth parameter, when true, tells the server to perform OAuth-style verification.
  function verifyJWT(jwt, useOAuth = false) {
    return new Promise(function(resolve, reject) {
      var payload = { token: jwt };
      if (useOAuth) {
        payload.use_oauth = true;
      }
      fetch('/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + jwt
        },
        body: JSON.stringify(payload)
      })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Invalid token');
          localStorage.removeItem('jwt');
        }
        return response.json();
      })
      .then(function(data) {
        // Expecting the server to return an object like { user: { id: '...' } }
        if (data && data.user && data.user.id) {
          resolve(data.user);
        } else {
          reject(new Error('Invalid server response'));
        }
      })
      .catch(reject);
    });
  }

  // Initialize the user session.
  // externalUserId should be provided from your external UUID generator for guest sessions.
  function initializeUser(externalUserId, useOAuth = false) {
    var storedJWT = localStorage.getItem('jwt');
    var storedUserId = localStorage.getItem('userId');

    if (storedJWT) {
      // If a JWT exists, verify it with the server.
      verifyJWT(storedJWT, useOAuth)
        .then(function(userData) {
          // Update the stored userId if necessary.
          if (!storedUserId || storedUserId !== userData.id) {
            localStorage.setItem('userId', userData.id);
          }
          console.log('Authenticated session with user:', userData);
        })
        .catch(function(error) {
          // JWT verification failed. Clear credentials and fallback to guest.
          localStorage.removeItem('jwt');
          localStorage.removeItem('userId');
          if (externalUserId) {
            localStorage.setItem('userId', externalUserId);
            console.log('JWT invalid. Using provided guest userId:', externalUserId);
          } else {
            console.log('JWT invalid and no external guest userId provided.');
          }
        });
    } else {
      // No JWT exists.
      if (!storedUserId && externalUserId) {
        localStorage.setItem('userId', externalUserId);
        console.log('No JWT found. Setting guest userId to provided external userId:', externalUserId);
      } else {
        console.log('No JWT found. Using existing guest userId:', storedUserId);
      }
    }
  }

  // Handle user login when an OAuth flow returns a JWT.
  function handleLogin(jwt, useOAuth = false) {
    localStorage.setItem('jwt', jwt);
    verifyJWT(jwt, useOAuth)
      .then(function(userData) {
        localStorage.setItem('userId', userData.id);
        console.log('Login successful. Updated userId to:', userData.id);
      })
      .catch(function(error) {
        console.error('JWT verification failed during login:', error);
        localStorage.removeItem('jwt');
        localStorage.removeItem('userId');
        // Optionally, trigger logout or prompt for re-login.
      });
  }

  // Expose the module's functions under a single namespace.
  window.AuthManager = {
    init: initializeUser,
    login: handleLogin,
    verify: verifyJWT
  };
})();
