# snapit-pkg

A simple tool to extract resources from Pkg executable dynamically.

## How

By default, nexe, pkg, and all Node.JS based portable executable generators do modify the Node.JS entrypoint.
At this point, they also implement snapshot fs system to embed their own resources.
Depending on the snapshot file system structure, it may be hard to extract.
However, by seeing the design of the executube, we could hook the entrypoint and inject user script into application.

It's true that we can get all data via binary analysis of all Node.JS application, but this is way better to handle.

## Why

- Recover unintentionally deleted files from built executable
- Reverse Engineering

## Usage

To use the tool, clone the repository and run `yarn && yarn start --file ./path-to-exe --type <type>`.
(This will install dependencies and run hooker)

**Available types**

- `pkg`: pkg version 5
- `pkg4`: pkg version 4

After hooking the executable, you can just run it to extract files.
It's dead simple, but dynamic.

## LICENSE

This tool is licensed under MIT.
Everything is free and open-sourced.

I am not associated with pkg or any packages mentioned here.
