export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyAjljHwjebOZTL-d-hP85F68ZfTIu1mN7Y',
    authDomain: 'bipj-nets.firebaseapp.com',
    projectId: 'bipj-nets',
    storageBucket: 'bipj-nets.firebasestorage.app',
    messagingSenderId: '1002680030354',
    appId: '1:1002680030354:web:44715065938b1429f9c24b',
  },
  /** Node/Express API. Relative — proxy.conf.json forwards to localhost:3000. */
  apiUrl: '/api',
  /** FastAPI service. Relative — proxy.conf.json rewrites /pyapi -> localhost:8000/api. */
  pyApiUrl: '/pyapi',
};
