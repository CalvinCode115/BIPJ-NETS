export const environment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyAjljHwjebOZTL-d-hP85F68ZfTIu1mN7Y',
    authDomain: 'bipj-nets.firebaseapp.com',
    projectId: 'bipj-nets',
    storageBucket: 'bipj-nets.firebasestorage.app',
    messagingSenderId: '1002680030354',
    appId: '1:1002680030354:web:44715065938b1429f9c24b',
  },
  /**
   * Both stay relative in production. vercel.json rewrites them to the Render
   * services, so the browser only ever talks to the Vercel origin — no CORS,
   * and the backend URLs can change without rebuilding the app.
   */
  apiUrl: '/api',
  pyApiUrl: '/pyapi',
};
