import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";

const WebSocketServer: any = require("websocket").server;

const server: any = http.createServer(function (request, response) {
    response.writeHead(404);
    response.end();
});

server.listen(33882, () => {
    console.log("http server started");
});

const wss: any = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

let connected_user: any = null;
let user: any = null;

wss.on("request", function (request: any) {
    if (connected_user) {
        request.reject();
        console.log("New user tried to connect while one is already connected, rejected.");
        return;
    }

    request.requestedProtocols.push("synx");

    const connection = request.accept("synx", request.origin);
    connected_user = connection;

    console.log(
        "New connection from",
        request.remoteAddress,
        ", awaiting authentication"
    );

    setTimeout(() => {
        if (!user && connected_user) {
            connected_user.close();
            console.log(
                "Current connected user failed to authenticate, closing connection."
            );
        }
    }, 1000);

    connection.on("message", function (message: any) {
        if (message.type !== "utf8") {
            return;
        }

        const split = message.utf8Data.split(":");

        if (split.length < 2) {
            return;
        }

        // AUTHENTICATION
        if (split[0] === "auth" && !user) {
            user = split[1];

            vscode.window.showInformationMessage(
                "Client " + user + " has connected"
            );

            console.log("User", user, "has authenticated");

            // AUTO EXECUTE CURRENT OPEN FILE
            const editor = vscode.window.activeTextEditor;

            if (editor && connected_user) {
                const script = editor.document.getText();

                connected_user.sendUTF(script);

                vscode.window.showInformationMessage(
                    "Auto executed current script"
                );

                console.log("Auto executed current editor script");
            }

            // AUTO EXECUTE FILE EXAMPLE
            // const fileScript = fs.readFileSync(
            //     "C:/script.lua",
            //     "utf8"
            // );
            // connected_user.sendUTF(fileScript);
        }

        // COMPILE ERROR
        else if (split[0] === "compile_err") {
            split[0] = "";

            vscode.window.showErrorMessage(
                split.join().slice(1)
            );
        }
    });

    connection.on("close", function () {
        console.log(
            "Connection closed from",
            connection.remoteAddress,
            "(",
            user,
            ")"
        );

        vscode.window.showInformationMessage(
            "Client " + user + " has disconnected"
        );

        connected_user = null;
        user = null;
    });
});

export function activate(context: vscode.ExtensionContext) {
    console.log("activate");

    // ACTIVATE COMMAND
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "synx-ws-serv.activate",
            () => {
                console.log("synapse-ws-serv activated");
            }
        )
    );

    // MANUAL EXECUTE COMMAND
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "synx-ws-serv.execute",
            () => {
                if (!user) {
                    vscode.window.showWarningMessage(
                        "No connected client"
                    );
                    return;
                }

                const editor = vscode.window.activeTextEditor;

                if (editor && connected_user) {
                    connected_user.sendUTF(
                        editor.document.getText()
                    );

                    vscode.window.showInformationMessage(
                        "Script executed"
                    );
                }
            }
        )
    );

    // STATUS BAR BUTTON
    const runItem: vscode.StatusBarItem =
        vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left
        );

    runItem.command = "synx-ws-serv.execute";
    runItem.tooltip = "Execute script";
    runItem.text = "$(debug-start) Custom Execute";
    runItem.show();

    context.subscriptions.push(runItem);
}

export function deactivate() {
    console.log("deactivate");

    if (connected_user) {
        connected_user.close();
    }

    server.close();
}
