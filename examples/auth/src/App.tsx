import { ClientAuthAuthenticated, ClientAuthUnauthenticated, useAuth } from 'nostalgie/auth';
import { createFunctionQuery } from 'nostalgie/functions';
import { Helmet } from 'nostalgie/helmet';
import * as React from 'react';
import { hello } from './functions';

const useHelloFunction = createFunctionQuery(hello);

export default function App() {
  const authState = useAuth();

  return (
    <>
      <Helmet>
        <title>Simple authentication example · Nostalgie</title>
        <meta
          name="description"
          content="A simple example of using Nostalgie authentication in both the front- and back-end"
        />
      </Helmet>
      <div className="flex flex-col items-center justify-center h-screen w-screen overflow-scroll max-w-none">
        {authState.isAuthentiated === true ? (
          <Authenticated auth={authState} />
        ) : (
          <NotAuthenticated auth={authState} />
        )}
        <pre></pre>
      </div>
    </>
  );
}

function Authenticated(props: { auth: ClientAuthAuthenticated }) {
  const authState = props.auth;
  const helloState = useHelloFunction([]);

  return (
    <div className="bg-blue-50 border-4 border-blue-200 px-8 py-7 w-4/5 text-center">
      <h1 className="text-4xl mb-8 mt-12 font-semibold">
        {'You are currently '}
        <strong className="underline font-black italic font-serif uppercase">
          {'authenticated'}
        </strong>
      </h1>
      <a
        className="border-red-900 bg-red-600 text-gray-50 hover:bg-red-800 px-7 py-4 text-2xl inline-block"
        href={authState.logoutUrl}
      >
        Log out
      </a>
      <h2 className="text-3xl mb-7 mt-11 font-medium">Your server function says</h2>
      <blockquote>{helloState.data}</blockquote>
      <h2 className="text-3xl mb-7 mt-11 font-medium">Your authentication information:</h2>
      <pre className="text-left border-gray-300 bg-gray-200 border-2 px-3 py-2 max-h-80 overflow-auto">
        {JSON.stringify(authState.credentials, null, 2)}
      </pre>
    </div>
  );
}

function NotAuthenticated(props: { auth: ClientAuthUnauthenticated }) {
  const authState = props.auth;
  const helloState = useHelloFunction([]);

  return (
    <div className="bg-red-50 border-4 border-red-200 px-8 py-7 w-4/5 text-center">
      <h1 className="text-4xl mb-8 mt-12 font-semibold">
        {'You are currently '}
        <strong className="underline font-black italic font-serif uppercase">
          {'not authenticated'}
        </strong>
      </h1>
      <a
        className="border-blue-900 bg-blue-600 text-gray-50 hover:bg-blue-800 px-7 py-4 text-2xl inline-block"
        href={authState.loginUrl}
      >
        Log in
      </a>
      <h2 className="text-3xl mb-7 mt-11 font-medium">Your server function says</h2>
      <blockquote>{helloState.data}</blockquote>
    </div>
  );
}
