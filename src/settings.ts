import * as Path from 'path';

export interface NostalgieSettings {
  applicationEntryPoint: string;
  functionsEntryPoint: string;
  buildDir: string;
  buildEnvironment: 'development' | 'production';
  rootDir: string;
}

type NostalgieSetting = keyof NostalgieSettings;

export interface NostalgieSettingsReader {
  get<K extends keyof NostalgieSettings>(setting: K): NostalgieSettings[K];
}

class StaticNostalgieSettings implements NostalgieSettingsReader {
  constructor(private readonly options: Partial<NostalgieSettings>) {}

  get<K extends NostalgieSetting>(setting: K): NostalgieSettings[K] {
    const rootDir = this.options.rootDir || process.cwd();

    switch (setting) {
      case 'applicationEntryPoint':
        return Path.resolve(rootDir, './src/App') as NostalgieSettings[K];
      case 'buildDir':
        return Path.resolve(rootDir, './build') as NostalgieSettings[K];
      case 'buildEnvironment':
        return (this.options.buildEnvironment || 'development') as NostalgieSettings[K];
      case 'functionsEntryPoint':
        return Path.resolve(rootDir, './src/functions') as NostalgieSettings[K];
      case 'rootDir':
        return rootDir as NostalgieSettings[K];
    }

    throw new Error(`Invariant violation: Unknown setting ${JSON.stringify(setting)}`);
  }
}

export function readNormalizedSettings(
  options: Partial<NostalgieSettings> = {}
): NostalgieSettingsReader {
  return new StaticNostalgieSettings(options);
}
