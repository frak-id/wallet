function readPackage(pkg, _context) {
    // all our workspaces start with @frak-labs
    if (pkg.name.startsWith("@frak-labs")) {
        return pkg;
    }

    const isReactInUse =
        "react" in pkg.dependencies ||
        "react" in pkg.devDependencies ||
        "react" in pkg.peerDependencies;
    const isTypesReactInUse =
        "@types/react" in pkg.devDependencies ||
        "@types/react" in pkg.peerDependencies ||
        "@types/react" in pkg.dependencies;

    if (isReactInUse || isTypesReactInUse) {
        delete pkg.devDependencies["@types/react"];
        const peerDependencies = pkg.peerDependencies || {};
        pkg.peerDependencies = peerDependencies;

        // our workspaces had 18 and 19 in use
        peerDependencies["@types/react"] = "18 || 19";
    }
    return pkg;
}

module.exports = {
    hooks: {
        readPackage,
    },
};
