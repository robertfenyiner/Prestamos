# Backups de RobertApp

RobertApp usa SQLite en `backend/data/robertapp.db`. Este documento explica como activar backups diarios en Ubuntu con systemd.

## Archivos incluidos

```text
scripts/backup-sqlite.sh
systemd/robertapp-backup.service
systemd/robertapp-backup.timer
```

## Instalar dependencias

```bash
sudo apt update
sudo apt install -y sqlite3 gzip
```

## Activar el script

```bash
cd /opt/RobertApp
chmod +x scripts/backup-sqlite.sh
sudo mkdir -p /opt/backups/robertapp
sudo chown -R robert:robert /opt/backups/robertapp
```

## Probar backup manual

```bash
/opt/RobertApp/scripts/backup-sqlite.sh
ls -lah /opt/backups/robertapp
```

## Instalar timer de systemd

```bash
sudo cp /opt/RobertApp/systemd/robertapp-backup.service /etc/systemd/system/robertapp-backup.service
sudo cp /opt/RobertApp/systemd/robertapp-backup.timer /etc/systemd/system/robertapp-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now robertapp-backup.timer
```

## Verificar estado

```bash
systemctl list-timers --all | grep robertapp || true
sudo systemctl status robertapp-backup.timer --no-pager
sudo systemctl start robertapp-backup.service
sudo systemctl status robertapp-backup.service --no-pager
ls -lah /opt/backups/robertapp
```

## Configuracion

El backup conserva archivos por 30 dias por defecto. Se puede cambiar con `RETENTION_DAYS` en `systemd/robertapp-backup.service`.

El backup se ejecuta todos los dias a las 03:15 segun `systemd/robertapp-backup.timer`.
