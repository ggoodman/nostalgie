import nodeResolve from 'resolve';

export const resolveAsync = (id: string, options: nodeResolve.AsyncOpts) =>
  new Promise<{
    path?: string;
    packageMeta?: {
      name: string;
      version: string;
      [key: string]: unknown;
    };
  }>((resolve, reject) => {
    return nodeResolve(id, options, (err, path, packageMeta) => {
      if (err) {
        return reject(err);
      }

      return resolve({
        path,
        packageMeta,
      });
    });
  });
