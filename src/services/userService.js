// THIS IS A DEMO OF AN AUTHENTICATED FETCH REQUEST

const BASE_URL = `${import.meta.env.VITE_BACK_END_SERVER_URL}`;

const currentUser = async () => {
  try {
    const config = {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
    const res = await fetch(`${BASE_URL}/current_user`, config);

    const data = await res.json();

    if (data.detail) {
      throw new Error(data.detail);
    }

    return data
  } catch (err) {
    console.log(err);
    throw new Error(err, { cause: err });
  }
};


export {
  currentUser,
};