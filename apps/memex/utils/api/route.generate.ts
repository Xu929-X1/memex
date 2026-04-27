import fs from "fs/promises";
import path from "path";
//This needs more work after MVP, potentially a small toolkit package, need to support 


async function scanDir(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...await scanDir(fullPath))
        } else if (entry.name === 'route.ts') {
            files.push(fullPath)
        }
    }

    return files
}

async function generateRouteFile() {
    const routeFilePaths = await scanDir(path.join(process.cwd(), '/app/api'));
    const routePathJson: Record<string, Record<string, string>> = {};

    for (const routeFilePath of routeFilePaths) {

        const content = await fs.readFile(routeFilePath, 'utf-8')
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].filter(method =>
            new RegExp(`export const ${method}`).test(content)
        )
        const normalized = routeFilePath.split(path.sep).join('/')
        const url = '/' + normalized
            .split('app/')[1]
            .replace('/route.ts', '');
        if (!routePathJson[url]) {
            routePathJson[url] = {};
        }
        for (const method of methods) {
            routePathJson[url][method] = url
        }
    }

    const routeFilePath = path.join(process.cwd(), "/generated/route-helper.ts");
    await fs.mkdir(path.dirname(routeFilePath), { recursive: true })

    try {

        await fs.writeFile(routeFilePath, JSON.stringify(routePathJson, null, 2));
        console.log("file written")
    } catch (error) {
        console.log(error);
    }

}

generateRouteFile();