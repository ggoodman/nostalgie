import { useAuth } from 'nostalgie/auth';
import * as React from 'react';

export function UserInfo() {
  const authInfo = useAuth();

  return authInfo.isAuthentiated ? (
    <div className="flex items-center text-sm h-full">
      <div className="w-8 h-8">
        <img
          className="rounded-full shadow-md"
          alt={authInfo.credentials!.user.name as string}
          src={authInfo.credentials!.user.picture as string}
        />
      </div>
      <div className="hidden md:block ml-3">
        <div className="w-32 truncate font-medium leading-tight">
          {authInfo.credentials!.user.name as string}
        </div>
        <a className="opacity-60 hover:opacity-90 uppercase text-center" href={authInfo.logoutUrl}>
          Log out
        </a>
      </div>
    </div>
  ) : (
    <div className="flex items-center text-sm h-full">
      <a className="opacity-60 hover:opacity-90 uppercase text-center" href={authInfo.loginUrl}>
        Log in
      </a>
    </div>
  );
}
