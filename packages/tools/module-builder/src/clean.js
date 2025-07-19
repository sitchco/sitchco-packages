import ProjectScanner from '@sitchco/project-scanner';

export async function cleanBuildArtifacts() {
    const projectScanner = new ProjectScanner();
    await projectScanner.cleanBuildArtifacts();
}
