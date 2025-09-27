export default function iifeWrapper() {
    return {
        name: 'iife-wrapper',
        generateBundle(options, bundle) {
            for (const [fileName, chunk] of Object.entries(bundle)) {
                // Only wrap entry JS chunks
                if (!(chunk.type === 'chunk' && chunk.isEntry && fileName.endsWith('.js'))) {
                    continue;
                }
                let code = chunk.code

                // Check if the code ends with a source map comment
                const sourceMapMatch = code.match(/\/\/# sourceMappingURL=.*$/m)
                let sourceMapComment = ''
                if (sourceMapMatch) {
                    sourceMapComment = sourceMapMatch[0]
                    // Remove the comment from the code
                    code = code.slice(0, sourceMapMatch.index)
                }

                // Wrap in IIFE
                chunk.code = `(function(){${code}})();${sourceMapComment}`
            }
        }
    }
}
