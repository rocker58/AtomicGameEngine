var fs = require('fs-extra');
var host = require("./Host");
var config = require("./BuildConfig");

namespace('package', function() {

    task('windows_editor', {
        async: true
    }, function() {

        var srcDir = config.artifactsRoot + "AtomicEditor/";
        var dstDir = config.artifactsRoot + "Dist/";

        host.cleanCreateDir(dstDir);

        var installerName = "AtomicEditor_Windows64_Setup_" + config.buildSHA + ".exe";
        var installerPath = config.artifactsRoot + "Dist/" + installerName;

        var nsisDefines = "/DATOMIC_ROOT=" + config.atomicRoot;
        nsisDefines += " /DEDITOR_VERSION=1";
        nsisDefines += " /DINSTALLER_NAME=" + installerName;

        var makeNSISCmd = config.atomicRoot + "\\Build\\Scripts\\Windows\\CreateInstaller.bat";
        makeNSISCmd += " " + nsisDefines + " " + config.atomicRoot + "/Build/Scripts/Windows/Installer/AtomicEditor.nsi";
        var editorExe = dstDir + "/AtomicEditor.exe";

        var pfxFile = process.env.ATOMIC_PFX_FILE;
        var pfxPW = process.env.ATOMIC_PFX_PW;

        var signBaseCmd = "signtool.exe sign /f " + pfxFile;
        signBaseCmd += " /p " + pfxPW;
        signBaseCmd += " /t http://timestamp.verisign.com/scripts/timestamp.dll";
        signBaseCmd += " /v ";

        var signEditorCmd = signBaseCmd + config.artifactsRoot + "AtomicEditor/AtomicEditor.exe";
        var signInstallerCmd = signBaseCmd + installerPath;

        var cmds = [];

        if (pfxFile && pfxPW) {
            cmds.push(signEditorCmd);
        }

        cmds.push(makeNSISCmd);

        if (pfxFile && pfxPW) {
            cmds.push(signInstallerCmd);
        }

        jake.exec(cmds, function() {
          complete();
        }, {
          printStdout: true
        });


    });

    task('mac_editor', {
        async: true
    }, function() {


        var editorAppFolder = config.editorAppFolder;
        var srcDir = config.artifactsRoot + "AtomicEditor/";
        var dstDir = config.artifactsRoot + "Dist/";
        var editorZip = dstDir + "AtomicEditor_MacOSX_" +  config.buildSHA + ".zip";
        var devIDApp = config.devIDApp;

        host.cleanCreateDir(dstDir);

        cmds = [];

        if (config.jenkins) {
            cmds.push("security unlock-keychain -p \"jenkins\" /Users/jenkins/Library/Keychains/login.keychain  ");
        }

        if (devIDApp) {
            cmds.push("codesign --deep --force --verify --verbose --sign \"Developer ID Application: " + devIDApp + "\" " + editorAppFolder);
        }

        cmds.push("cd " + srcDir + " && zip -r -X " + editorZip +" ./AtomicEditor.app");

        jake.exec(cmds, function() {

          console.log("Packaged Mac Editor to ", editorZip);

          if (!devIDApp) {
              console.log("\nDeveloper ID Application not specified, code is not be signed!\n\n");
          }

          complete();

        }, {
          printStdout: true,
          printStderr: true
        });

    });
    
    task('linux_editor', {
        async: true
    }, function() {

        // check if all the commands exist : fakeroot, dpkg-deb

        var editorAppFolder = config.editorAppFolder;
        var srcDir = config.artifactsRoot + "AtomicEditor/";
        var dstDir = config.artifactsRoot + "Dist/";
        var dstDeb = config.artifactsRoot + "AtomicGameEngine_0.0.8_amd64.deb";
        
        host.cleanCreateDir(dstDir);  // create new staging directory
        fs.removeSync(dstDeb);  // remove old one, if there
        
        // copy in the two magic dirs
        fs.copySync(config.atomicRoot + "Build/Linux/DEBIAN", dstDir + "DEBIAN");
        fs.copySync(config.atomicRoot + "Build/Linux/usr", dstDir + "usr" );

        // copy in the atomic dir
        fs.copySync(editorAppFolder, dstDir + "usr/share/AtomicGameEngine" );
       
        //copy in menu pixmap
        fs.copySync(config.atomicRoot + "Build/Linux/atomic_menu.xpm", dstDir + "usr/share/AtomicGameEngine/atomic_menu.xpm" );
        
        // get rid of some lintian errors
        fs.removeSync( dstDir + "usr/share/AtomicGameEngine/Resources/ToolData/.gitignore");
        fs.removeSync( dstDir + "usr/share/AtomicGameEngine/Resources/ToolData/CodeEditor/.gitignore");
        fs.removeSync( dstDir + "usr/share/AtomicGameEngine/Resources/ToolData/Deployment/Android/assets/.gitignore");
        fs.removeSync( dstDir + "usr/share/AtomicGameEngine/Resources/ToolData/ProjectTemplates/.gitignore");
        fs.removeSync( dstDir + "usr/share/AtomicGameEngine/Resources/ToolData/TypeScriptSupport/.gitignore");

        cmds = [];
        
        // go to staging root directory
        cmds.push("cd " + config.artifactsRoot + " ;" );
        
        // get rid of some more lintian errors
        cmds.push("/usr/bin/strip --strip-unneeded " + dstDir + "usr/share/AtomicGameEngine/AtomicEditor ;" );
        cmds.push("/usr/bin/strip --strip-unneeded " + dstDir + "usr/share/AtomicGameEngine/Resources/ToolData/Deployment/Linux/AtomicPlayer ;" );
        cmds.push("/bin/chmod oug-wx " + dstDir + "usr/share/AtomicGameEngine/libcef.so ;");

        // needs fakeroot for package file ownership issues
        cmds.push("/usr/bin/fakeroot /usr/bin/dpkg-deb --build " + dstDir + ";");

        // fix the deb name
        cmds.push("/bin/mv " + config.artifactsRoot + "Dist.deb " + dstDeb + " ;");

        // clean up the staging area
        cmds.push("/bin/rm -rf "+  dstDir + " ;");

        jake.exec(cmds, function() {

          console.log("Packaged Linux Editor to " + dstDeb );

          complete();

        }, {
          printStdout: true,
          printStderr: true
        });

    });

});