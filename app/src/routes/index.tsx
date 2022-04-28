import { Link } from 'nostalgie/routing';
import { useTwind } from 'nostalgie/twind';
import { H3 } from '../design/headers';
import { Heading } from '../design/Heading';
import { Text } from '../design/Text';

export default function () {
  const tw = useTwind();

  return (
    <div className={tw('px-4 py-6 text-gray-900')}>
      <header>
        <Heading size="xl" as="h1">
          Remember when web development was <em>simple</em>?
        </Heading>
        <Text size="xl" as="p">
          Nostalgie is an opinionated, full-stack, runtime-agnostic framework
          for building web apps and web pages using react.
        </Text>
      </header>
      <div
        className={tw(
          'flex flex-col md:flex-row items-center md:space-x-4 space-y-4 md:space-y-0 mb-10'
        )}
      >
        <Link
          to="/docs/tutorials/getting-started"
          className={tw(
            'px-5 py-3 bg-purple-700 text-gray-50 block rounded-lg text-xl font-bold'
          )}
        >
          Get started
        </Link>
        <pre
          className={tw(
            'bg-gray-100 md:text-xl text-gray-800 px-5 py-3 rounded-lg w-full md:w-3/4'
          )}
        >
          <code>npx create-nostalgie-app my-app</code>
        </pre>
      </div>
      <p
        className={tw(
          'text-gray-600 max-w-screen-lg text-xl sm:text-3xl sm:leading-10 font-light italic mb-20 md:mb-32'
        )}
      >
        Try it. You're less than 30 seconds away from that feeling you thought
        you had lost forever.
      </p>
      <div id="opinionated" className={tw('mb-20 md:mb-32 w-full lg:w-3/5')}>
        <h2
          className={tw(
            'sm:text-lg sm:leading-snug font-semibold tracking-wide uppercase text-purple-600 mb-3'
          )}
        >
          Opinionated
        </h2>
        <Heading size="lg" as="p">
          Nostalgie is opinionated so that you don't have to be.
        </Heading>
        <Text size="xl" as="p">
          Nostalgie focuses on areas that are critical to every modern web. It
          makes a bet on leading technologies in each category. In having these
          opinions and in making these choices, Nostalgie provides a tightly
          integrated, highly-productive environment to get @#$% done.
        </Text>
      </div>
      <div
        id="server-functions"
        className={tw('mb-20 md:mb-32 w-full lg:w-3/5')}
      >
        <h2
          className={tw(
            'sm:text-lg sm:leading-snug font-semibold tracking-wide uppercase text-red-600 mb-3'
          )}
        >
          Server Functions
        </h2>
        <Heading size="lg" as="p">
          Calling APIs and server-side logic is unnecessarily painful. It
          doesn't have to be.
        </Heading>
        <Text size="xl" as="p">
          Nostalgie automatically wires your server-side functions to your
          client-side hooks with typing, authentication, caching and
          deduplication. You may even realize that you don't need complex state
          management anymore.
        </Text>
        <H3>Server</H3>
        <H3>Browser</H3>
      </div>
      <div id="features" className={tw('mb-20')}>
        <div className={tw('w-full lg:w-3/5 mb-8')}>
          <h2
            className={tw(
              'sm:text-lg sm:leading-snug font-semibold tracking-wide uppercase text-blue-600 mb-3'
            )}
          >
            Features
          </h2>
          <Heading size="lg" as="p">
            Nostalgie has you covered for the critical parts of your app.
          </Heading>
          <Text size="xl" as="p">
            There are a few things that almost every app needs but that are{' '}
            <em>hard</em> and repetitive. It's a lot of work to do these things
            well and while you're struggling with them, you're not building your
            app. Nostalgie frees you from this burden so that you get get on
            innovating and delivering value.
          </Text>
        </div>
        <div
          className={tw(
            'grid grid-cols-1 grid-flow-row grid-rows-auto md:grid-cols-2 lg:grid-cols-3 gap-8'
          )}
        >
          <div className={tw('border rounded-lg overflow-hidden shadow')}>
            <div
              className={tw(
                'bg-green-400 text-green-900 px-4 py-2 text-xl sm:text-3xl'
              )}
            >
              <h2>Routing</h2>
            </div>
            <div className={tw('p-4 leading-7')}>
              <p>
                Your app lives on the web and the web works with URLs. Nostalgie
                has you covered.
              </p>
              <ul>
                <li>
                  <h3 className={tw('text-lg font-semibold')}>
                    Code splitting
                  </h3>
                  <p>
                    Easy and idiomatic code splitting. You use{' '}
                    <code>React.lazy</code> and we handle the rest. Ten layers
                    of lazy components? No problem; these will render, fully
                    hydrated in a single pass on the server.
                  </p>
                </li>
                <li>
                  <h3 className={tw('text-lg font-semibold')}>
                    Best practices
                  </h3>
                  <p>
                    Only the code needed by your users will be sent to them.
                    Every bit of critical JavaScript and CSS will be preloaded.
                    Waterfalls are beautiful but we don't want them in our web
                    apps.
                  </p>
                </li>
              </ul>
            </div>
          </div>
          <div className={tw('border rounded-lg overflow-hidden shadow')}>
            <div
              className={tw(
                'bg-pink-400 text-pink-900 px-4 py-2 text-xl sm:text-3xl'
              )}
            >
              <h2>Authentication</h2>
            </div>
            <div className={tw('p-4 leading-7')}>
              <p>
                Sometimes you need to know who is using your app. You may even
                want to know who is using your app during server rendering.
                Nostalgie makes this easy:
              </p>
              <ul>
                <li>
                  <h3 className={tw('text-lg font-semibold')}>
                    Integrated login
                  </h3>
                  <p>
                    You configure Nostalgie with any compliant OpenID provider
                    and you're all set. You can log in users and know their
                    identity and scopes whether you're in a Server Function or
                    in a React component.
                  </p>
                </li>
                <li>
                  <h3 className={tw('text-lg font-semibold')}>
                    Easy authorization
                  </h3>
                  <p>
                    Wrap any component using the{' '}
                    <code>withAuthenticationRequired</code> helper to restrict
                    it to authorized users. With a fallback render prop, you can
                    render an alternative for unauthorized users with an
                    automatically-generated login url.
                  </p>
                </li>
              </ul>
            </div>
          </div>
          <div className={tw('border rounded-lg overflow-hidden shadow')}>
            <div
              className={tw(
                'bg-yellow-400 text-yellow-900 px-4 py-2 text-xl sm:text-3xl'
              )}
            >
              <h2>SEO</h2>
            </div>
            <div className={tw('p-4 leading-7')}>
              <p>
                Getting the right information to all the right crawlers in React
                apps has never been easy. Nostalgie makes it easy.
              </p>
              <ul>
                <li>
                  <h3 className={tw('text-lg font-semibold')}>
                    Manage <code>head</code> tags
                  </h3>
                  <p>
                    Nostalgie integrates with `react-helmet-async` so that you
                    can tweak your top-level markup anywhere in the render tree.
                    Five levels deep in lazy-loaded components? No problem.
                  </p>
                </li>
                <li>
                  <h3 className={tw('text-lg font-semibold')}>
                    SSR out of the box
                  </h3>
                  <p>
                    Because of how Nostalgie does server-side rendering, your
                    SEO tags will be rendered on the server no matter where you
                    set them.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
