import { Array, Optional, Record, Result, Static, String } from 'runtypes';
import type { Plugin } from './plugin';

const NostalgieSettings = Record({
  appEntrypoint: Optional(String),
  functionsEntrypoint: Optional(String),
  plugins: Optional(
    Array(
      Record({
        name: String,
      })
    )
  ),
});
export interface NostalgieSettings extends Static<typeof NostalgieSettings> {
  plugins?: Plugin[];
}

export function createSettings(settings: NostalgieSettings): NostalgieSettings {
  return settings;
}

export function validateSettings(
  userSettings: unknown
): Result<NostalgieSettings> {
  return NostalgieSettings.validate(userSettings) as Result<NostalgieSettings>;
}
