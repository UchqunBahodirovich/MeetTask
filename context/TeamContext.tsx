import React, { createContext, useContext, useMemo } from 'react';
import { User } from '../types';
import { MOCK_USERS } from '../constants';

interface TeamContextValue {
  team: User[];
  /** Look a member up by id; returns undefined for removed or unknown members. */
  memberById: (id: string) => User | undefined;
}

const TeamContext = createContext<TeamContextValue>({
  team: MOCK_USERS,
  memberById: (id) => MOCK_USERS.find((user) => user.id === id),
});

export const TeamProvider: React.FC<{ team: User[]; children: React.ReactNode }> = ({ team, children }) => {
  const value = useMemo<TeamContextValue>(
    () => ({ team, memberById: (id) => team.find((user) => user.id === id) }),
    [team],
  );
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = () => useContext(TeamContext);
