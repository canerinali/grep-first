# Python recipes

Standard library and installed packages. Use the same `python3` the project runs.
Each block marked `sh example` is executed by the test suite.

## 1. Does the attribute exist, and where is it defined?

```sh example
python3 -c "import pathlib, inspect; f = pathlib.Path.walk; print(inspect.getsourcefile(f), inspect.getsourcelines(f)[1]); print(inspect.signature(f))"
```

The first line is the `file:line` evidence, the second is the signature.

## 2. Probe a symbol that may not exist

`hasattr` never raises, so it is safe to try a guess.

```sh example
python3 -c "import itertools; print('chunked', hasattr(itertools, 'chunked')); print('batched', hasattr(itertools, 'batched'))"
```

`False` means write `Unverified: itertools.chunked` and suggest what does exist (here `itertools.batched`, Python 3.12+).

## 3. List the real names close to a guess

```sh example
python3 -c "import shutil; print([n for n in dir(shutil) if 'copy' in n])"
```

## 4. Find where a module lives, then grep it

```sh example
python3 -c "import json; print(json.__file__)"
python3 -c "import sys; print(sys.version.split()[0])"
grep -n '^def ' "$(python3 -c 'import json; print(json.__file__)')"
```

For third-party packages, `python3 -c "import importlib.metadata as m; print(m.version('pkg'))"` gives the installed version and `python3 -m site` lists the `site-packages` directories to search.
