import * as React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="bg-white dark:bg-blue-800 ">
      <div className="lg:flex lg:items-center lg:justify-between w-full mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 z-20">
        <h2 className="text-3xl font-extrabold text-black dark:text-white sm:text-4xl">
          <span className="block">This is</span>
          <span className="block text-indigo-500">
            The <strong>Home</strong> page.
          </span>
        </h2>
        <div className="lg:mt-0 lg:flex-shrink-0">
          <div className=" inline-flex rounded-md shadow">
            <Link
              to="/about"
              className="py-4 px-6 bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 focus:ring-offset-yellow-200 text-white w-full transition ease-in duration-200 text-center text-base font-semibold py-2 px-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              About
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
