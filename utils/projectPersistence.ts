import { DAWProject, AudioDAWClip, DAWTrack } from '../types';

export const serializeProject = (project: DAWProject): string => {
    const projectToSave = {
        ...project,
        tracks: project.tracks.map(track => {
            // FIX: Use 'any' type for the temporary track object to allow modification for serialization.
            const serializableTrack: any = { ...track };
            
            serializableTrack.clips = track.clips.map(clip => {
                if (clip.type === 'audio') {
                    // Create a version of the clip without the non-serializable AudioBuffer
                    const { audioBuffer, ...rest } = clip as AudioDAWClip;
                    return rest;
                }
                return clip;
            });

            return serializableTrack;
        })
    };
    return JSON.stringify(projectToSave, null, 2);
};

export const saveProjectToFile = (project: DAWProject): void => {
    const serializedData = serializeProject(project);
    const blob = new Blob([serializedData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gemini-daw-project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


export const loadProjectFromFile = (file: File): Promise<DAWProject> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loadedProject = JSON.parse(event.target?.result as string);
                // Here you might add validation to ensure it's a valid project structure
                resolve(loadedProject as DAWProject);
            } catch (error) {
                reject(new Error("Failed to parse project file."));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
};