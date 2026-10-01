import { createContext, useState } from 'react';
import { getUserFromToken } from '../lib/helpers/jwt-helpers';

const UserContext = createContext();

function UserProvider({ children }) {

 const [user, setUser] = useState(getUserFromToken())

 const value = { user, setUser }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export { UserProvider, UserContext };
