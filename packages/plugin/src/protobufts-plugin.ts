import {DescEnum, DescExtension, DescFile, DescMessage} from "@bufbuild/protobuf";
import {create, createFileRegistry, FileRegistry} from "@bufbuild/protobuf";
import type {FileDescriptorSet} from "@bufbuild/protobuf/wkt";
import {CodeGeneratorResponse_Feature, FileDescriptorSetSchema} from "@bufbuild/protobuf/wkt";
import {nestedTypes} from "@bufbuild/protobuf/reflect";
import type {CodeGeneratorRequest} from "@bufbuild/protobuf/wkt";
import {setupCompiler} from "./framework/typescript-compile";
import {GeneratedFile} from "./framework/generated-file";
import {OutFile} from "./out-file";
import {Options, parseOptions} from "./options";
import {CommentGenerator} from "./code-gen/comment-generator";
import {MessageInterfaceGenerator} from "./code-gen/message-interface-generator";
import {EnumGenerator} from "./code-gen/enum-generator";
import {FileTable} from "./file-table";
import * as ts from "typescript";
import {WellKnownTypes} from "./message-type-extensions/well-known-types";
import {Interpreter} from "./interpreter";
import {SymbolTable} from "./framework/symbol-table";
import {TypeScriptImports} from "./framework/typescript-imports";
import {PluginBaseProtobufES} from "./framework/plugin-base";


export class ProtobuftsPlugin extends PluginBaseProtobufES {


    constructor(private readonly version: string) {
        super();
        this.version = version;
    }


    generate(request: CodeGeneratorRequest): GeneratedFile[] {
        const
            options = parseOptions(
                request.parameter,
                `by protobuf-ts ${this.version}` + (request.parameter ? ` with parameter ${request.parameter}` : '')
            ),
            registry = createFileRegistryFromRequest(request),
            symbols = new SymbolTable(),
            fileTable = new FileTable(options),
            imports = new TypeScriptImports(symbols, registry),
            comments = new CommentGenerator(),
            interpreter = new Interpreter(registry, options),
            genMessageInterface = new MessageInterfaceGenerator(symbols, imports, comments, interpreter, options),
            genEnum = new EnumGenerator(symbols, imports, comments, interpreter)
        ;

        // register file names for proto files
        for (let fileDescriptor of registry.files) {
            const base = fileDescriptor.name + (options.addPbSuffix ? "_pb" : "");
            fileTable.register(base + '.ts', fileDescriptor);
        }

        // generate files
        for (let descFile of registry.files) {
            const outMain = fileTable.create(descFile);

            // register all symbols
            for (const desc of nestedTypes(descFile)) {
                switch (desc.kind) {
                    case "enum":
                        genEnum.registerSymbols(outMain, desc);
                        break;
                    case "message":
                        genMessageInterface.registerSymbols(outMain, desc);
                        break;
                }
            }

            // generate TypeScript interfaces and enums
            for (const desc of nestedTypes(descFile)) {
                switch (desc.kind) {
                    case "message":
                        genMessageInterface.generateMessageInterface(outMain, desc)
                        break;
                    case "enum":
                        genEnum.generateEnum(outMain, desc);
                        break;
                }
            }
        }


        // plugins should only return files requested to generate
        // unless our option "generate_dependencies" is set.
        // We always return well-known types, because we do not
        // maintain them in a package - they are always generated
        // on demand.
        let tsFiles = fileTable.outFiles.concat();
        if (!options.generateDependencies) {
            tsFiles = tsFiles.filter(file => {
                const protoFilename = file.descFile.proto.name;
                if (request.fileToGenerate.includes(protoFilename)) {
                    return true;
                }
                if (WellKnownTypes.protoFilenames.includes(protoFilename)) {
                    return true;
                }
                return false;
            });
        }

        // if a proto file is imported to use custom options, or if a proto file declares custom options,
        // we do not to emit it. unless it was explicitly requested.
        // TODO why does the fallback condition include "used" files? isn't that what generateDependencies should do?
        tsFiles = tsFiles.filter(of =>
            request.fileToGenerate.includes(of.descFile.proto.name)
            || this.isFileUsed(of.descFile, tsFiles.map(x => x.descFile))
        );

        return this.transpile(tsFiles, options);
    }


    protected transpile(tsFiles: OutFile[], options: Options): GeneratedFile[] {
        if (options.transpileTarget === undefined) {
            return tsFiles;
        }
        const opt: ts.CompilerOptions = {
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            skipLibCheck: true,
            declaration: true,
            module: options.transpileModule,
            target: options.transpileTarget,
        };
        const [program,] = setupCompiler(opt, tsFiles, tsFiles.map(f => f.getFilename()));
        const results: GeneratedFile[] = [];
        let err: Error | undefined;
        program.emit(undefined, (fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: readonly ts.SourceFile[]) => {
            // We have to go through some hoops here because the header we add to each file
            // is not part of the AST. So we find the TypeScript file we generated for each
            // emitted file and add the header to each output ourselves.
            if (!sourceFiles) {
                err = new Error(`unable to map emitted file "${fileName}" to a source file: missing source files`)
                return;
            }
            if (sourceFiles.length !== 1) {
                err = new Error(`unable to map emitted file "${fileName}" to a source file: expected 1 source file, got ${sourceFiles.length}`)
                return;
            }
            const tsFile = tsFiles.find(x => sourceFiles[0].fileName === x.getFilename());
            if (!tsFile) {
                err = new Error(`unable to map emitted file "${fileName}" to a source file: not found`)
                return;
            }
            const content = tsFile.getHeader() + data;
            results.push({
                getFilename() {
                    return fileName;
                },
                getContent() {
                    return content;
                }
            });
        });
        if (err) {
            throw err;
        }
        return results;
    }


    // we support proto3-optionals, so we let protoc know
    protected getSupportedFeatures = () => [CodeGeneratorResponse_Feature.PROTO3_OPTIONAL];


    private isFileUsed(descFile: DescFile, files: Iterable<DescFile>): boolean {
        for (const type of nestedTypes(descFile)) {
            // Skip services since we don't generate them
            if (type.kind === 'service') {
                continue;
            }
            // TODO do not consider referencing a type that a file defines itself used - filter the second argument to exclude the current file
            if (this.isTypeUsed(type, files)) {
                return true;
            }
        }
        return false;
    }

    private isTypeUsed(type: DescMessage | DescEnum | DescExtension, files: Iterable<DescFile>): boolean {
        for (const otherFile of files) {
            for (const otherType of nestedTypes(otherFile)) {
                if (otherType.kind === "message") {
                    if (otherType.fields.some(descField => descField.message?.typeName === type.typeName)) {
                        return true;
                    }
                    if (otherType.fields.some(descField => descField.enum?.typeName === type.typeName)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

}

export function createFileRegistryFromRequest(request: CodeGeneratorRequest): FileRegistry {
    const set = create(FileDescriptorSetSchema, {
        file: request.protoFile,
    }) as FileDescriptorSet;
    return createFileRegistry(set);
}
