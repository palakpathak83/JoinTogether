import esbuild from 'esbuild';

export default {
  process(sourceText, sourcePath) {
    const result = esbuild.transformSync(sourceText, {
      loader: sourcePath.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'node22',
      sourcemap: 'inline',
      sourcefile: sourcePath,
    });
    return { code: result.code };
  },
};
