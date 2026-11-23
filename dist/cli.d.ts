import { Command } from 'commander';

declare function createProgram(): Command;
declare function run(): Promise<void | Command>;

export { createProgram, run };
