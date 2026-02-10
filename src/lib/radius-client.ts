import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface CoaDisconnectParams {
  nasIp: string;
  nasPort?: number;
  secret: string;
  username: string; // Full RADIUS username with tenant prefix
}

export interface CoaChangeRateParams extends CoaDisconnectParams {
  rateLimit: string; // MikroTik-Rate-Limit value
}

/**
 * Sends CoA Disconnect-Request to NAS to terminate user session
 * Uses radclient CLI tool (must be installed via freeradius-utils)
 *
 * @param params CoA parameters
 * @returns true if disconnect was successful, false otherwise
 */
export async function sendCoaDisconnect(
  params: CoaDisconnectParams
): Promise<boolean> {
  const { nasIp, nasPort = 3799, secret, username } = params;

  // Sanitize username to prevent command injection
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "");

  const radclientInput = `User-Name = "${safeUsername}"`;

  try {
    const command = `echo '${radclientInput}' | radclient ${nasIp}:${nasPort} disconnect "${secret}"`;
    const { stdout, stderr } = await execAsync(command, { timeout: 5000 });

    // radclient returns success if it receives a response packet
    if (stdout.includes("Received response ID")) {
      console.log(`[RADIUS] CoA disconnect successful for ${username} on ${nasIp}`);
      return true;
    }

    console.warn(
      `[RADIUS] CoA disconnect failed for ${username} on ${nasIp}:`,
      stdout,
      stderr
    );
    return false;
  } catch (error) {
    console.error(
      `[RADIUS] CoA disconnect error for ${username} on ${nasIp}:`,
      error
    );
    return false;
  }
}

/**
 * Sends CoA packet to change user bandwidth in real-time
 * Uses radclient CLI tool (must be installed via freeradius-utils)
 *
 * @param params CoA parameters including new rate limit
 * @returns true if rate change was successful, false otherwise
 */
export async function sendCoaChangeRate(
  params: CoaChangeRateParams
): Promise<boolean> {
  const { nasIp, nasPort = 3799, secret, username, rateLimit } = params;

  // Sanitize username to prevent command injection
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "");

  const radclientInput = `User-Name = "${safeUsername}"
Mikrotik-Rate-Limit = "${rateLimit}"`;

  try {
    const command = `echo '${radclientInput}' | radclient ${nasIp}:${nasPort} coa "${secret}"`;
    const { stdout, stderr } = await execAsync(command, { timeout: 5000 });

    if (stdout.includes("Received response ID")) {
      console.log(
        `[RADIUS] CoA rate-change successful for ${username} on ${nasIp} to ${rateLimit}`
      );
      return true;
    }

    console.warn(
      `[RADIUS] CoA rate-change failed for ${username} on ${nasIp}:`,
      stdout,
      stderr
    );
    return false;
  } catch (error) {
    console.error(
      `[RADIUS] CoA rate-change error for ${username} on ${nasIp}:`,
      error
    );
    return false;
  }
}

/**
 * Checks if radclient is installed on the system
 * Should be called during app initialization
 */
export async function checkRadclientAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("which radclient", { timeout: 2000 });
    return stdout.trim().length > 0;
  } catch (error) {
    console.warn(
      "[RADIUS] radclient not found. CoA features will not work. Install with: apt-get install freeradius-utils"
    );
    return false;
  }
}
