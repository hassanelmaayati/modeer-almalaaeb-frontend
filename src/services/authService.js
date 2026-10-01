// src/services/authService.js

import { parseToken, registerToken } from "../lib/helpers/jwt-helpers";

// Use the `VITE_BACK_END_SERVER_URL` environment variable to set the base URL.
// Note the `/auth` path added to the server URL that forms the base URL for
// all the requests in this service.
const BASE_URL = `${import.meta.env.VITE_BACK_END_SERVER_URL}`;

const signUp = async (formData) => {
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    if (data.detail) {
      throw new Error(data.detail);
    }

    if (data.token) {
      // first save the raw token in local storage
      registerToken(data.token)
      // then extract the payload (second part of the token)
      return parseToken(data.token)
    }

    throw new Error('Invalid response from server');
  } catch (err) {
    console.log(err);
    throw new Error(err, { cause: err });
  }
};

const signIn = async (formData) => {
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    if (data.detail) {
      throw new Error(data.detail);
    }

    if (data.token) {
      // first save the raw token in local storage
      registerToken(data.token)

      return parseToken(data.token)
    }

    throw new Error('Invalid response from server');
  } catch (err) {
    console.log(err);
    throw new Error(err, { cause: err });
  }
};

export {
  signUp,
  signIn,
};
