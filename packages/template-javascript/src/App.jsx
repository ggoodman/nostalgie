import { useQueryFunction } from 'nostalgie/functions';
import { getPainPoint } from './functions';

export default function App() {
  // Let's call getPainPoint and ask the value to refresh periodically so that we have a good
  // understanding of all the kinds of pain developers are used to suffering. 😭
  const painPointState = useQueryFunction(getPainPoint, [], {
    refetchInterval: 5000,
    staleTime: 5000,
  });

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 flex flex-row items-center justify-center">
      <main className="px-12 py-16 text-center">
        <h1 className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl">
          Hello <span className="text-indigo-600">Nostalgie</span>
        </h1>
        <h2 className="mt-3 text-base text-gray-400 sm:mt-5 sm:text-lg sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
          <span>Goodbye </span>
          <span className="text-gray-300 font-medium">
            {painPointState.isSuccess ? painPointState.data.painType : 'Friction'}
          </span>
        </h2>
        <p className="my-12 w-3/4 mx-auto text-gray-300 leading-7">
          Now that you're living in the future, it's OK reminisce about the past. There is no longer
          any friction between you and your ideas. It's time to unleash your creativity!
        </p>
      </main>
    </div>
  );
}
